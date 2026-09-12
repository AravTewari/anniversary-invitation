# Parul & Ashu's 25th Anniversary Invitation

A mobile-first invitation with a private RSVP form. GitHub Pages hosts the public site. Supabase stores the invitation list and responses.

## URLs

- Website: `https://aravtewari.github.io/anniversary-invitation/`
- Repository: `https://github.com/AravTewari/anniversary-invitation`
- General RSVP: the normal website URL
- Personal RSVP: `https://aravtewari.github.io/anniversary-invitation/#invite=<private-token>`

A personal link prefills the family name, available phone or email, and maximum party size. The guest still selects attendance and enters the number attending. A general link opens the same form without saved details.

Personal links stay in the address bar during in-page navigation. Refreshing the page reloads the same family details and shows the envelope again.

## Supabase setup

1. Create one Supabase project.
2. Open the SQL Editor and run `supabase/schema.sql` once.
3. Import the private invitation CSV into the `rsvps` table.
4. Copy the project URL and the **publishable** key into `site-config.js`.
5. Test one personal link and one general response.

Never put a Supabase secret key or service-role key in this repository. The publishable key is the only key intended for the browser.

The database has row-level security enabled. Public visitors cannot read, update, or delete RSVP rows. They can use only the two token-aware database functions defined in `supabase/schema.sql`.

## Guest-list import

Start with a private CSV that has these columns:

```csv
family_label,max_party_size,expected_email,expected_phone,planning_status
Example Family,4,example@example.com,+14085550123,Maybe
```

Generate stable private links:

```sh
node scripts/generate-invite-links.mjs private/expected-families.csv
```

The script writes:

- `expected-families.supabase.csv` for the Supabase table import
- `expected-families.links.csv` for the hosts to distribute

Both files contain private information. Keep them outside Git and share them only with the hosts.

## Organizer view

Use the Supabase Table Editor or the `organizer_rsvp_status` view. The view shows expected families, pending responses, attendance, party size, contact details, notes, and campaign consent.

Do not build or publish an organizer page. Supabase is the private admin surface for this one event.

## RSVP alerts and Google Sheets

The notification flow is:

```text
Supabase rsvps insert/update -> rsvp-notify Edge Function -> Google Apps Script + host SMS
```

1. Open the planning spreadsheet and add a bound Apps Script project.
2. Paste `google-apps-script/Code.gs` into the project.
3. Reload the spreadsheet. Use **RSVP sync → Configure** and enter a long random shared secret and an optional host email.
4. Deploy the Apps Script as a web app that executes as you and allows anyone to access it. Copy its `/exec` URL.
5. Deploy both Supabase functions in `supabase/functions`.
6. Set these Supabase Edge Function secrets:

```text
RSVP_WEBHOOK_SECRET
GOOGLE_APPS_SCRIPT_URL
GOOGLE_APPS_SCRIPT_SECRET
HOST_PHONE_E164
TWILIO_ACCOUNT_SID
TWILIO_API_KEY
TWILIO_API_SECRET
TWILIO_MESSAGING_SERVICE_SID
CAMPAIGN_ADMIN_SECRET
```

Use a Twilio API key and secret for the deployed functions. Do not use the account Auth Token in deployed code.

Create a Supabase Database Webhook for `public.rsvps` on `INSERT` and `UPDATE`. Send it to:

```text
https://bcmxwtlfndvdsbiwaams.supabase.co/functions/v1/rsvp-notify
```

Add this HTTP header to the webhook:

```text
x-rsvp-webhook-secret: <the RSVP_WEBHOOK_SECRET value>
```

The Google script creates an `RSVP Responses` tab in the existing planning spreadsheet. It updates rows by the
internal RSVP ID, so an edited response does not create a duplicate. The host receives a short SMS for each new or
changed RSVP. Imported planning rows are ignored until a guest responds.

## Guest SMS campaign

The host confirmed that invited guests have already agreed to event texts. New or updated RSVPs with a phone number save SMS consent without a checkbox; email-only RSVPs do not. Existing records are not changed until a guest saves their RSVP. Campaigns include only attending guests with saved SMS consent. Twilio continues to block recipients who reply STOP. Preview the audience first:

```sh
CAMPAIGN_ADMIN_SECRET=<secret> node scripts/send-sms-campaign.mjs --message "Dinner starts at 6 PM."
```

Send after the preview is correct:

```sh
CAMPAIGN_ADMIN_SECRET=<secret> node scripts/send-sms-campaign.mjs --message "Dinner starts at 6 PM." --send
```

The sender name and STOP instructions are added automatically.

## Site settings

Edit `site-config.js` for the couple's names, date, venue, schedule, photo, and public RSVP connection. Do not add guest names or phone numbers to that file.

Legacy display-only family links still work:

```text
https://aravtewari.github.io/anniversary-invitation/#family=Ashu%20%26%20Family
```

Use token links for real personalized RSVPs. Family-name links are not private and do not select a saved invitation record.

## Local preview

Run a static server in this folder:

```sh
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

Every push to `main` publishes through the GitHub Pages workflow.

## Music

The site includes the host-provided `assets/manwa-laage-guitar.mp3`. Opening the invitation starts it at low volume. Playback fades out after 42 seconds and stops after 50 seconds.
