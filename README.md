# Parul & Ashu's 25th Anniversary Invitation

A mobile-first invitation with a private RSVP form. GitHub Pages hosts the public site. Supabase stores the invitation list and responses.

## URLs

- Website: `https://aravtewari.github.io/anniversary-invitation/`
- Repository: `https://github.com/AravTewari/anniversary-invitation`
- General RSVP: the normal website URL
- Personal RSVP: `https://aravtewari.github.io/anniversary-invitation/#invite=<private-token>`

A personal link prefills the family name, available phone or email, and maximum party size. The guest still selects attendance and enters the number attending. A general link opens the same form without saved details.

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
