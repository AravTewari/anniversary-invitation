const RELEVANT_FIELDS = [
  "responded_at",
  "response_name",
  "response_email",
  "response_phone",
  "attending",
  "party_size",
  "dietary_notes",
  "message",
  "sms_opt_in",
];

export function cleanSingleLine(value, maximum = 120) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function shouldProcessRsvpWebhook(payload) {
  if (!payload || payload.schema !== "public" || payload.table !== "rsvps") return false;
  if (payload.type !== "INSERT" && payload.type !== "UPDATE") return false;
  if (!payload.record || typeof payload.record.id !== "string" || !payload.record.responded_at) return false;
  if (payload.type === "INSERT") return true;

  const previous = payload.old_record || {};
  return RELEVANT_FIELDS.some((field) => payload.record[field] !== previous[field]);
}

export function rsvpEventId(record) {
  return `${record.id}:${record.updated_at || record.responded_at}`;
}

export function rsvpDisplayName(record) {
  return cleanSingleLine(record.response_name || record.family_label || "Guest", 70);
}

export function hostRsvpMessage(record) {
  const name = rsvpDisplayName(record);
  if (record.attending) {
    const partySize = Number.isInteger(record.party_size) ? record.party_size : Number(record.party_size) || 1;
    return `RSVP: ${name} - yes, ${partySize} attending.`;
  }
  return `RSVP: ${name} - cannot attend.`;
}

export function normalizePhoneToE164(value) {
  const raw = cleanSingleLine(value, 32);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

export function campaignMessage(value) {
  const message = cleanSingleLine(value, 260);
  if (!message) throw new Error("Enter a campaign message.");
  const body = `Parul & Ashu: ${message} Reply STOP to opt out.`;
  if (body.length > 320) throw new Error("Keep the campaign message under 260 characters.");
  return body;
}

export function uniqueCampaignRecipients(rows) {
  const recipients = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || row.sms_opt_in !== true || row.attending !== true || !row.responded_at) continue;
    const phone = normalizePhoneToE164(row.response_phone);
    if (!phone || recipients.has(phone)) continue;
    recipients.set(phone, {
      name: rsvpDisplayName(row),
      phone,
    });
  }
  return Array.from(recipients.values());
}
