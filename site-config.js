// Public invitation settings. Never put a Supabase secret or service-role key here.
window.INVITATION_CONFIG = Object.freeze({
  couple: {
    partner1: "Parul",
    partner2: "Ashu",
  },
  yearsTogether: 25,
  weddingYear: 2001,
  celebrationYear: "Onwards",
  invitationMessage:
    "Having you with us will make this milestone truly complete. Please join us as we celebrate twenty-five years of love, laughter, and lifelong friendships.",
  defaultFamily: "Family & Friends",
  dateLabel: "Sunday, December 20, 2026",
  timeLabel: "5:30 PM Pacific Time",
  eventStart: "2026-12-20T17:30:00-08:00",
  venueName: "Royale Sakoon, Fremont",
  venueAddress: "5200 Mowry Ave Suite K, Fremont, CA 94538",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=5200%20Mowry%20Ave%20Suite%20K%2C%20Fremont%2C%20CA%2094538",
  calendarUrl: "",
  cityLabel: "Fremont, California",
  dressCodeWomen: "Cocktail sarees or lehengas.",
  dressCodeMen: "Western formal — suits or dinner jackets.",
  rsvpDeadline: "Please reply at your earliest convenience.",
  rsvp: {
    supabaseUrl: "https://bcmxwtlfndvdsbiwaams.supabase.co",
    publishableKey: "sb_publishable_YBNp_63wWgcBLwgF_Rm9aw_S0_pCM5V",
    lookupFunction: "get_invite",
    submitFunction: "submit_rsvp",
    generalMaxPartySize: 7,
  },
  photoUrl: "./assets/parul-ashu.jpg",
  photoAlt: "Parul and Ashu smiling together beneath a floral arch",
  hostedBy: "Hosted with love by Arav and Avni",
  timeline: [
    {
      title: "Welcome and grand entry",
    },
    {
      title: "Cake cutting",
    },
    {
      title: "Celebration, program, and games",
    },
    {
      title: "Dinner and dance",
    },
  ],
});
