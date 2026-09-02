create extension if not exists pgcrypto;

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invite_token uuid not null unique default gen_random_uuid(),

  source text not null default 'personalized'
    check (source in ('personalized', 'general')),

  -- Values imported from the private planning sheet. Guest submissions never overwrite them.
  family_label text,
  expected_email text,
  expected_phone text,
  planning_status text,
  max_party_size smallint not null default 7
    check (max_party_size between 1 and 7),

  -- Values supplied or confirmed by a guest.
  response_name text,
  response_email text,
  response_phone text,
  attending boolean,
  party_size smallint,
  dietary_notes text,
  message text,

  email_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  email_opt_in_at timestamptz,
  sms_opt_in_at timestamptz,

  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint personalized_invite_has_label check (
    source <> 'personalized'
    or nullif(btrim(family_label), '') is not null
  ),

  constraint response_is_complete check (
    (
      responded_at is null
      and attending is null
      and party_size is null
      and response_name is null
      and response_email is null
      and response_phone is null
    )
    or
    (
      responded_at is not null
      and attending is not null
      and nullif(btrim(response_name), '') is not null
      and (
        nullif(btrim(response_email), '') is not null
        or nullif(btrim(response_phone), '') is not null
      )
      and (
        (attending is true and party_size is not null and party_size between 1 and max_party_size)
        or (attending is false and party_size = 0)
      )
    )
  ),

  constraint email_consent_has_email check (
    not email_opt_in or nullif(btrim(response_email), '') is not null
  ),

  constraint sms_consent_has_phone check (
    not sms_opt_in or nullif(btrim(response_phone), '') is not null
  )
);

alter table public.rsvps enable row level security;
revoke all on table public.rsvps from public, anon, authenticated;

-- The random token is a private link. This function returns only that invitation.
create or replace function public.get_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    'maxPartySize', v_row.max_party_size,
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
$$;

create or replace function public.submit_rsvp(
  p_token text,
  p_name text,
  p_email text,
  p_phone text,
  p_attending boolean,
  p_party_size integer,
  p_dietary_notes text,
  p_message text,
  p_email_opt_in boolean,
  p_sms_opt_in boolean,
  p_website text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_row public.rsvps%rowtype;
  v_name text;
  v_email text;
  v_phone text;
  v_notes text;
  v_message text;
  v_max integer;
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
    v_max := 7;
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

    v_max := v_row.max_party_size;
    v_mode := 'updated';
  end if;

  v_party_size := case when p_attending then p_party_size else 0 end;

  if p_attending and (
    v_party_size is null
    or v_party_size < 1
    or v_party_size > v_max
  ) then
    raise exception 'Party size must be between 1 and %.', v_max using errcode = '22023';
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
      max_party_size,
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
      7,
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
$$;

revoke all on function public.get_invite(text) from public;
revoke all on function public.submit_rsvp(
  text, text, text, text, boolean, integer,
  text, text, boolean, boolean, text
) from public;

grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_rsvp(
  text, text, text, text, boolean, integer,
  text, text, boolean, boolean, text
) to anon, authenticated;

create view public.organizer_rsvp_status
with (security_invoker = true)
as
select
  family_label,
  planning_status,
  max_party_size,
  expected_email,
  expected_phone,
  response_name,
  response_email,
  response_phone,
  case
    when responded_at is null then 'Pending'
    when attending then 'Attending'
    else 'Declined'
  end as rsvp_status,
  party_size,
  dietary_notes,
  message,
  email_opt_in,
  sms_opt_in,
  responded_at,
  updated_at
from public.rsvps
order by coalesce(family_label, response_name);

revoke all on table public.organizer_rsvp_status from public, anon, authenticated;
