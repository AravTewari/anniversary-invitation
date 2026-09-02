// Public invitation settings. Never put a Supabase secret or service-role key here.
window.INVITATION_CONFIG = Object.freeze({
  couple: {
    partner1: "Parul",
    partner2: "Ashu",
  },
  yearsTogether: 25,
  weddingYear: 2001,
  celebrationYear: 2026,
  eventTitle: "Parul & Ashu's Silver Jubilee",
  invitationMessage:
    "Together with our family, we invite you to celebrate twenty-five years of love, laughter, friendship, and shared memories.",
  defaultFamily: "Family & Friends",
  dateLabel: "Sunday, December 20, 2026",
  timeLabel: "5:30 PM Pacific Time",
  eventStart: "2026-12-20T17:30:00-08:00",
  venueName: "Royale Sakoon, Fremont",
  venueAddress: "5200 Mowry Ave, Fremont, CA 94538",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=5200%20Mowry%20Ave%2C%20Fremont%2C%20CA%2094538",
  calendarUrl: "",
  cityLabel: "Fremont, California",
  dressCode: "Festive elegance with a touch of silver, champagne, or rose.",
  rsvpDeadline: "Please reply as soon as you can.",
  rsvp: {
    supabaseUrl: "https://bcmxwtlfndvdsbiwaams.supabase.co",
    publishableKey: "sb_publishable_YBNp_63wWgcBLwgF_Rm9aw_S0_pCM5V",
    lookupFunction: "get_invite",
    submitFunction: "submit_rsvp",
    generalMaxPartySize: 7,
  },
  photoUrl: "./assets/anniversary-artwork.png",
  photoAlt: "Gold wedding rings framed by burgundy and blush flowers",
  hostedBy: "Hosted with love by Arav and family",
  contactText: "Questions? Please contact Arav or the host who shared this invitation.",
  timeline: [
    {
      time: "6:00–6:30",
      title: "Guest arrival, cocktails & live music",
      description: "30 minutes",
    },
    {
      time: "6:30–6:40",
      title: "Grand entrance",
      description: "10 minutes",
    },
    {
      time: "6:40–6:50",
      title: "Welcome by MC",
      description: "10 minutes",
    },
    {
      time: "6:50–7:05",
      title: "Family slideshow and video",
      description: "15 minutes",
    },
    {
      time: "7:05–7:25",
      title: "Kids and family dance performance",
      description: "20 minutes",
    },
    {
      time: "7:25–7:40",
      title: "Interactive game with guests",
      description: "15 minutes",
    },
    {
      time: "7:40–8:00",
      title: "Couple story and speeches",
      description: "20 minutes",
    },
    {
      time: "8:00–8:20",
      title: "Professional dance and singing performance",
      description: "20 minutes",
    },
    {
      time: "8:20–8:35",
      title: "Couple dance and open dance floor",
      description: "15 minutes",
    },
    {
      time: "8:35–8:50",
      title: "Cake cutting and champagne toast",
      description: "15 minutes",
    },
    {
      time: "8:50–9:00",
      title: "Dinner announcement",
      description: "10 minutes",
    },
  ],
});
