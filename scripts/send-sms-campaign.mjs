const args = process.argv.slice(2);
const messageIndex = args.indexOf("--message");
const message = messageIndex >= 0 ? args[messageIndex + 1] : "";
const shouldSend = args.includes("--send");
const projectUrl = (process.env.SUPABASE_PROJECT_URL || "https://bcmxwtlfndvdsbiwaams.supabase.co").replace(/\/$/, "");
const adminSecret = process.env.CAMPAIGN_ADMIN_SECRET;

if (!message) {
  console.error('Usage: CAMPAIGN_ADMIN_SECRET=... node scripts/send-sms-campaign.mjs --message "Event update" [--send]');
  process.exit(1);
}
if (!adminSecret) {
  console.error("CAMPAIGN_ADMIN_SECRET is required.");
  process.exit(1);
}

const response = await fetch(`${projectUrl}/functions/v1/send-sms-campaign`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-campaign-secret": adminSecret,
  },
  body: JSON.stringify({ message, dryRun: !shouldSend }),
});
const result = await response.json().catch(() => ({ ok: false, error: "The server returned an invalid response." }));
console.log(JSON.stringify(result, null, 2));
if (!response.ok || !result.ok) process.exit(1);

if (!shouldSend) {
  console.log("Dry run only. Add --send to send this message to the listed guests.");
}
