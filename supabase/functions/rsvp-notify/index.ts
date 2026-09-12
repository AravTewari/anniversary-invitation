import { getRequiredEnv, jsonResponse, secretsMatch } from "../_shared/http.ts";
import { hostRsvpMessage, normalizePhoneToE164, rsvpEventId, shouldProcessRsvpWebhook } from "../_shared/rsvp.js";
import { sendSms } from "../_shared/twilio.ts";

type RsvpRecord = Record<string, unknown> & {
  id: string;
  responded_at: string;
  updated_at?: string;
};

type DatabaseWebhook = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: RsvpRecord;
  old_record?: Record<string, unknown> | null;
};

async function updateGoogleSheet(payload: DatabaseWebhook): Promise<void> {
  const scriptUrl = getRequiredEnv("GOOGLE_APPS_SCRIPT_URL");
  const sheetSecret = getRequiredEnv("GOOGLE_APPS_SCRIPT_SECRET");
  const response = await fetch(scriptUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      secret: sheetSecret,
      eventId: rsvpEventId(payload.record),
      record: payload.record,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error("Google Sheets rejected the update.");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed." }, 405);

  try {
    const webhookSecret = getRequiredEnv("RSVP_WEBHOOK_SECRET");
    if (!secretsMatch(request.headers.get("x-rsvp-webhook-secret"), webhookSecret)) {
      return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
    }

    const payload = (await request.json()) as DatabaseWebhook;
    if (!shouldProcessRsvpWebhook(payload)) return jsonResponse({ ok: true, ignored: true });

    const hostPhones = [...new Set(getRequiredEnv("HOST_PHONES_E164").split(",").map(normalizePhoneToE164))];
    if (hostPhones.some((phone) => !phone)) throw new Error("HOST_PHONES_E164 must contain valid comma-separated phone numbers.");
    const message = hostRsvpMessage(payload.record);

    const jobs = [
      { name: "sheet", promise: updateGoogleSheet(payload) },
      ...hostPhones.map((phone, index) => ({ name: `hostSms${index + 1}`, promise: sendSms(phone, message) })),
    ];
    const results = await Promise.allSettled(jobs.map((job) => job.promise));
    const failed = results.flatMap((result, index) => (result.status === "rejected" ? [jobs[index].name] : []));

    if (failed.length) return jsonResponse({ ok: false, failed }, 502);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "RSVP notification failed.");
    return jsonResponse({ ok: false, error: "RSVP notification failed." }, 500);
  }
});
