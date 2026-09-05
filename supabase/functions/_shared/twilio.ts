import { getRequiredEnv } from "./http.ts";

export async function sendSms(to: string, body: string): Promise<string> {
  const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
  const apiKey = getRequiredEnv("TWILIO_API_KEY");
  const apiSecret = getRequiredEnv("TWILIO_API_SECRET");
  const messagingServiceSid = getRequiredEnv("TWILIO_MESSAGING_SERVICE_SID");
  const params = new URLSearchParams({
    To: to,
    Body: body,
    MessagingServiceSid: messagingServiceSid,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: params,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.sid !== "string") {
    const code = typeof result.code === "number" ? ` (${result.code})` : "";
    throw new Error(`Twilio rejected the message${code}.`);
  }
  return result.sid;
}
