# Parul & Ashu's 25th Anniversary Invitation

A mobile-first invitation that sends RSVP responses to Partiful. The site itself stores no guest data.

## Personalize the invitation

Edit `site-config.js`. Set the couple's names, date, venue, message, dress code, timeline, RSVP deadline, and Partiful event URL.

The Partiful link must be an HTTPS URL on `partiful.com`, for example:

```js
partifulUrl: "https://partiful.com/e/your-event-code",
```

To add a portrait:

1. Put an optimized `.webp` or `.jpg` image in `assets/`.
2. Set `photoUrl` to `"./assets/couple-photo.webp"`.
3. Replace `photoAlt` with a short description of the photo.

If `partifulUrl` is empty, RSVP buttons stay on the page and show a clear "link coming soon" message. They never send guests to a placeholder event.

## Personalized links

The `family` URL fragment changes the greeting:

```text
https://aravtewari.github.io/anniversary-invitation/#family=Ashu%20%26%20Family
```

The older query format also works, but the fragment format is preferred because it keeps the family name out of normal server request logs. The value is display text only. It is not a password and it does not control Partiful access.

## Preview locally

Run a static file server in this folder. For example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/#family=Ashu%20%26%20Family`.

## GitHub Pages

- Repository: `https://github.com/AravTewari/anniversary-invitation`
- Website: `https://aravtewari.github.io/anniversary-invitation/`
- Every push to `main` publishes through the included GitHub Actions workflow.

The canonical URL and social-sharing image metadata are already set to the public website.

Do not add a guest spreadsheet, phone numbers, email addresses, or private Partiful exports to this repository.

## Partiful configuration

- Event title: `Parul & Ashu's 25th Wedding Anniversary`
- Date and time: December 20, 2026 at 5:30 PM Pacific Time
- Venue: Royale Sakoon, Fremont
- Additional guests: up to six, with names required
- Required questions: full name, email, and mobile phone
- Optional questions: dietary or accessibility needs, email consent, and SMS consent
- Discoverability: Partiful shows the event as Private, but anyone with the link can open it because no password is set.

Before sending invitations:

- Add each organizer as a cohost.
- Invite guests directly through Partiful if you need to remind people who have not responded.
- Submit one test RSVP, export the CSV, and send one test message before launch.
