begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Remove only the pre-RSVP per-family count; preserve all guest responses.
lock table public.rsvps in access exclusive mode;
create temporary table rsvp_preservation_check on commit drop as
select id, to_jsonb(r) - 'max_party_size' as data from public.rsvps r;

drop view public.organizer_rsvp_status;
alter table public.rsvps drop constraint response_is_complete;
alter table public.rsvps drop column max_party_size;
alter table public.rsvps add constraint response_is_complete check (
  (responded_at is null and attending is null and party_size is null
    and response_name is null and response_email is null and response_phone is null)
  or
  (responded_at is not null and attending is not null
    and nullif(btrim(response_name), '') is not null
    and (nullif(btrim(response_email), '') is not null or nullif(btrim(response_phone), '') is not null)
    and ((attending is true and party_size is not null and party_size between 1 and 7)
      or (attending is false and party_size = 0)))
);

CREATE OR REPLACE FUNCTION public.get_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token uuid;
  v_row public.rsvps%rowtype;
begin
  if p_token is null
     or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return jsonb_build_object('found', false);
  end if;

  v_token := p_token::uuid;

  select *
  into v_row
  from public.rsvps
  where invite_token = v_token;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'familyLabel', coalesce(v_row.family_label, v_row.response_name),
    'hasResponded', v_row.responded_at is not null,
    'form', jsonb_build_object(
      'name', coalesce(v_row.response_name, v_row.family_label, ''),
      'email', coalesce(nullif(v_row.response_email, ''), nullif(v_row.expected_email, ''), ''),
      'phone', coalesce(nullif(v_row.response_phone, ''), nullif(v_row.expected_phone, ''), ''),
      'attending', v_row.attending,
      'partySize', v_row.party_size,
      'dietaryNotes', coalesce(v_row.dietary_notes, ''),
      'message', coalesce(v_row.message, ''),
      'emailOptIn', v_row.email_opt_in,
      'smsOptIn', v_row.sms_opt_in
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_rsvp(p_token text, p_name text, p_email text, p_phone text, p_attending boolean, p_party_size integer, p_dietary_notes text, p_message text, p_email_opt_in boolean, p_sms_opt_in boolean, p_website text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token uuid;
  v_row public.rsvps%rowtype;
  v_name text;
  v_email text;
  v_phone text;
  v_notes text;
  v_message text;
  v_party_size integer;
  v_email_opt_in boolean := coalesce(p_email_opt_in, false);
  v_sms_opt_in boolean := coalesce(p_sms_opt_in, false);
  v_now timestamptz := now();
  v_mode text;
begin
  -- Honeypot: report success without storing an obvious bot submission.
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    return jsonb_build_object('ok', true, 'mode', 'accepted');
  end if;

  v_name := nullif(
    regexp_replace(btrim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone := nullif(btrim(coalesce(p_phone, '')), '');
  v_notes := nullif(btrim(coalesce(p_dietary_notes, '')), '');
  v_message := nullif(btrim(coalesce(p_message, '')), '');

  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Enter a valid name.' using errcode = '22023';
  end if;

  if v_email is null and v_phone is null then
    raise exception 'Enter an email address or phone number.' using errcode = '22023';
  end if;

  if v_email is not null and (
    char_length(v_email) > 254
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  if v_phone is not null and (
    char_length(v_phone) < 7
    or char_length(v_phone) > 32
    or v_phone !~ '^[0-9+() .xX-]+$'
  ) then
    raise exception 'Enter a valid phone number.' using errcode = '22023';
  end if;

  if p_attending is null then
    raise exception 'Select whether you will attend.' using errcode = '22023';
  end if;

  if char_length(coalesce(v_notes, '')) > 500
     or char_length(coalesce(v_message, '')) > 1000
  then
    raise exception 'The response is too long.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_token, '')), '') is null then
    v_mode := 'created';
  else
    if p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'This invitation link is not valid.' using errcode = '22023';
    end if;

    v_token := p_token::uuid;

    select *
    into v_row
    from public.rsvps
    where invite_token = v_token
    for update;

    if not found then
      raise exception 'This invitation link is not valid.' using errcode = '22023';
    end if;

    v_mode := 'updated';
  end if;

  v_party_size := case when p_attending then p_party_size else 0 end;

  if p_attending and (
    v_party_size is null
    or v_party_size < 1
    or v_party_size > 7
  ) then
    raise exception 'Party size must be between 1 and 7.' using errcode = '22023';
  end if;

  if v_email_opt_in and v_email is null then
    raise exception 'Email consent requires an email address.' using errcode = '22023';
  end if;

  if v_sms_opt_in and v_phone is null then
    raise exception 'SMS consent requires a phone number.' using errcode = '22023';
  end if;

  if v_mode = 'created' then
    insert into public.rsvps (
      source,
      response_name,
      response_email,
      response_phone,
      attending,
      party_size,
      dietary_notes,
      message,
      email_opt_in,
      sms_opt_in,
      email_opt_in_at,
      sms_opt_in_at,
      responded_at,
      updated_at
    )
    values (
      'general',
      v_name,
      v_email,
      v_phone,
      p_attending,
      v_party_size,
      v_notes,
      v_message,
      v_email_opt_in,
      v_sms_opt_in,
      case when v_email_opt_in then v_now end,
      case when v_sms_opt_in then v_now end,
      v_now,
      v_now
    )
    returning invite_token into v_token;
  else
    update public.rsvps as r
    set response_name = v_name,
        response_email = v_email,
        response_phone = v_phone,
        attending = p_attending,
        party_size = v_party_size,
        dietary_notes = v_notes,
        message = v_message,
        email_opt_in = v_email_opt_in,
        sms_opt_in = v_sms_opt_in,
        email_opt_in_at = case
          when v_email_opt_in then coalesce(r.email_opt_in_at, v_now)
          else null
        end,
        sms_opt_in_at = case
          when v_sms_opt_in then coalesce(r.sms_opt_in_at, v_now)
          else null
        end,
        responded_at = coalesce(r.responded_at, v_now),
        updated_at = v_now
    where r.invite_token = v_token;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'inviteToken', v_token::text
  );
end;
$function$;

create view public.organizer_rsvp_status with (security_invoker = true) as
 SELECT family_label,
    planning_status,
    expected_email,
    expected_phone,
    response_name,
    response_email,
    response_phone,
        CASE
            WHEN responded_at IS NULL THEN 'Pending'::text
            WHEN attending THEN 'Attending'::text
            ELSE 'Declined'::text
        END AS rsvp_status,
    party_size,
    dietary_notes,
    message,
    email_opt_in,
    sms_opt_in,
    responded_at,
    updated_at
   FROM rsvps
  ORDER BY (COALESCE(family_label, response_name));
revoke all on table public.organizer_rsvp_status from public, anon, authenticated, service_role;
grant truncate, references, trigger, maintain on table public.organizer_rsvp_status to service_role;

do $verify$
begin
  if exists (
    select 1 from rsvp_preservation_check b
    full join public.rsvps r using (id)
    where b.data is distinct from to_jsonb(r)
  ) then
    raise exception 'RSVP data changed unexpectedly; rolling back.';
  end if;
end;
$verify$;

commit;
