// Public invitation settings. Never put a Supabase secret or service-role key here.
window.INVITATION_CONFIG = Object.freeze({
  couple: {
    partner1: "Parul",
    partner2: "Ashu",
  },
  yearsTogether: 25,
  weddingYear: 2001,
  celebrationYear: 2026,
  invitationMessage:
    "are celebrating 25 years of marriage. Join us for dinner and dancing in their honor.",
  defaultFamily: "Family & Friends",
  dateLabel: "Sunday, December 20, 2026",
  timeLabel: "5:30 PM Pacific Time",
  eventStart: "2026-12-20T17:30:00-08:00",
  venueName: "Royale Sakoon, Fremont",
  venueAddress: "5200 Mowry Ave, Fremont, CA 94538",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=5200%20Mowry%20Ave%2C%20Fremont%2C%20CA%2094538",
  calendarUrl: "",
  cityLabel: "Fremont, California",
  dressCode: "Festive Indian or cocktail attire; silver, champagne, and rose are welcome.",
  rsvpDeadline: "Please reply as soon as you can.",
  rsvp: {
    supabaseUrl: "https://bcmxwtlfndvdsbiwaams.supabase.co",
    publishableKey: "sb_publishable_YBNp_63wWgcBLwgF_Rm9aw_S0_pCM5V",
    lookupFunction: "get_invite",
    submitFunction: "submit_rsvp",
    generalMaxPartySize: 7,
  },
  photoUrl: "./assets/parul-ashu.jpg",
  photoAlt: "Parul and Ashu smiling together beneath a floral arch",
  hostedBy: "Hosted with love by Arav and family",
  contactText: "Questions? Please contact Arav or the host who shared this invitation.",
  timeline: [
    {
      time: "6:00 PM",
      title: "Welcome and cocktails",
      description: "",
    },
    {
      time: "7:00 PM",
      title: "Celebration program",
      description: "",
    },
    {
      time: "8:30 PM",
      title: "Dinner, cake, and dancing",
      description: "",
    },
  ],
});
