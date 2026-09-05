import { getRequiredEnv, jsonResponse, secretsMatch } from "../_shared/http.ts";
import { campaignMessage, uniqueCampaignRecipients } from "../_shared/rsvp.js";
import { sendSms } from "../_shared/twilio.ts";

type CampaignRequest = {
  message?: unknown;
  dryRun?: unknown;
};

async function loadRecipients(): Promise<Array<Record<string, unknown>>> {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const secretKeys = JSON.parse(getRequiredEnv("SUPABASE_SECRET_KEYS"));
  const secretKey = secretKeys.default;
  if (typeof secretKey !== "string" || !secretKey.startsWith("sb_secret_")) {
    throw new Error("The default Supabase secret key is unavailable.");
  }
  const url = new URL("/rest/v1/rsvps", supabaseUrl);
  url.searchParams.set(
    "select",
    "id,family_label,response_name,response_phone,sms_opt_in,attending,responded_at",
  );
  url.searchParams.set("sms_opt_in", "eq.true");
  url.searchParams.set("attending", "eq.true");
  url.searchParams.set("responded_at", "not.is.null");
  url.searchParams.set("order", "responded_at.asc");

  const response = await fetch(url, {
    headers: {
      apikey: secretKey,
    },
  });
  if (!response.ok) throw new Error("Could not load opted-in guests.");
  return await response.json();
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed." }, 405);

  try {
    const adminSecret = getRequiredEnv("CAMPAIGN_ADMIN_SECRET");
    if (!secretsMatch(request.headers.get("x-campaign-secret"), adminSecret)) {
      return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
    }

    const input = (await request.json()) as CampaignRequest;
    const body = campaignMessage(input.message);
    const dryRun = input.dryRun !== false;
    const recipients = uniqueCampaignRecipients(await loadRecipients());

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dryRun: true,
        message: body,
        recipientCount: recipients.length,
        recipients: recipients.map((recipient) => recipient.name),
      });
    }

    const failed: string[] = [];
    let sent = 0;
    for (const recipient of recipients) {
      try {
        await sendSms(recipient.phone, body);
        sent += 1;
      } catch {
        failed.push(recipient.name);
      }
    }

    return jsonResponse({ ok: failed.length === 0, dryRun: false, sent, failed });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "SMS campaign failed.");
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "SMS campaign failed." }, 400);
  }
});
