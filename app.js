(function () {
  "use strict";

  const config = window.INVITATION_CONFIG;

  if (!config) {
    document.body.classList.remove("is-locked");
    throw new Error("Invitation configuration is missing.");
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function cleanText(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const cleaned = value.normalize("NFKC").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
    return cleaned || fallback;
  }

  function setText(selector, value) {
    $$(selector).forEach((element) => {
      element.textContent = String(value ?? "");
    });
  }

  function isSafeHttpUrl(value, allowedHosts) {
    if (!value) return false;

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return false;
      return !allowedHosts || allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }

  function applyConfig() {
    setText('[data-config="partner1"]', config.couple.partner1);
    setText('[data-config="partner2"]', config.couple.partner2);
    setText('[data-config="yearsTogether"]', config.yearsTogether);
    setText('[data-config="weddingYear"]', config.weddingYear);
    setText('[data-config="celebrationYear"]', config.celebrationYear);

    [
      "eventTitle",
      "invitationMessage",
      "dateLabel",
      "timeLabel",
      "venueName",
      "venueAddress",
      "dressCode",
      "rsvpDeadline",
      "hostedBy",
      "contactText",
    ].forEach((key) => setText(`[data-config="${key}"]`, config[key]));

    $("#months-together").textContent = String(Number(config.yearsTogether || 0) * 12);
    document.title = `${config.yearsTogether} Years of Love | ${config.couple.partner1} & ${config.couple.partner2}`;
  }

  function applyPersonalization() {
    const fragmentFamily = new URLSearchParams(window.location.hash.slice(1)).get("family");
    const queryFamily = new URLSearchParams(window.location.search).get("family");
    const rawFamily = fragmentFamily ?? queryFamily;
    const family = cleanText(rawFamily, config.defaultFamily).slice(0, 80);
    $("#personal-greeting").textContent = `Dear ${family},`;
    $("#gate-family").textContent = `Open for ${family}`;
  }

  function applyPhoto() {
    const photo = $("#couple-photo");
    const placeholder = $("#portrait-placeholder");

    if (!config.photoUrl) return;

    photo.src = config.photoUrl;
    photo.alt = cleanText(config.photoAlt, "Anniversary couple");
    photo.hidden = false;
    placeholder.hidden = true;

    photo.addEventListener("error", () => {
      photo.hidden = true;
      placeholder.hidden = false;
    });
  }

  function applyExternalLinks() {
    const externalLinks = [
      { selector: "#maps-link", url: config.mapsUrl },
      { selector: "#calendar-link", url: config.calendarUrl },
    ];

    externalLinks.forEach(({ selector, url }) => {
      const link = $(selector);
      if (!isSafeHttpUrl(url)) return;
      link.href = url;
      link.hidden = false;
      link.rel = "noopener noreferrer";
    });

    const partifulReady = isSafeHttpUrl(config.partifulUrl, ["partiful.com"]);
    const rsvpStatus = $("#rsvp-status");

    $$('[data-rsvp-link]').forEach((link) => {
      if (partifulReady) {
        link.href = config.partifulUrl;
        link.removeAttribute("aria-disabled");
        link.classList.remove("is-disabled");
        return;
      }

      link.href = "#rsvp";
      link.setAttribute("aria-disabled", "true");
      link.classList.add("is-disabled");
      link.addEventListener("click", () => {
        rsvpStatus.hidden = false;
      });
    });

    return partifulReady;
  }

  function renderTimeline() {
    const timeline = $("#timeline");
    timeline.replaceChildren();

    config.timeline.forEach((item) => {
      const row = document.createElement("li");
      row.className = "timeline-item reveal";

      const time = document.createElement("div");
      time.className = "timeline-time";
      time.textContent = cleanText(item.time);

      const content = document.createElement("div");
      content.className = "timeline-content";

      const title = document.createElement("h3");
      title.textContent = cleanText(item.title);

      const description = document.createElement("p");
      description.textContent = cleanText(item.description);

      content.append(title, description);
      row.append(time, content);
      timeline.append(row);
    });
  }

  function setupInvitationGate() {
    const gate = $("#invitation-gate");
    const openButton = $("#open-invitation");
    const main = $("#main-content");
    const backgroundElements = [$("#site-header"), main, $("footer"), $("#mobile-rsvp")];

    function setBackgroundInert(isInert) {
      backgroundElements.forEach((element) => {
        element.inert = isInert;
        if (isInert) element.setAttribute("aria-hidden", "true");
        else element.removeAttribute("aria-hidden");
      });
    }

    function openInvitation(shouldFocus = true) {
      gate.classList.add("is-open");
      document.body.classList.remove("is-locked");
      setBackgroundInert(false);

      try {
        window.sessionStorage.setItem("anniversary-invitation-open", "true");
      } catch {
        // Storage can be unavailable in private browsing. The invitation still works.
      }

      window.setTimeout(() => {
        gate.hidden = true;
        if (shouldFocus) main.focus({ preventScroll: true });
      }, 720);
    }

    let alreadyOpened = false;
    try {
      alreadyOpened = window.sessionStorage.getItem("anniversary-invitation-open") === "true";
    } catch {
      alreadyOpened = false;
    }

    if (alreadyOpened) {
      gate.hidden = true;
      document.body.classList.remove("is-locked");
      setBackgroundInert(false);
      return;
    }

    setBackgroundInert(true);
    window.requestAnimationFrame(() => openButton.focus({ preventScroll: true }));
    gate.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      openButton.focus({ preventScroll: true });
    });
    openButton.addEventListener("click", () => openInvitation(true));
  }

  function setupHeader() {
    const header = $("#site-header");
    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function setupRevealAnimations() {
    const items = $$(".reveal:not(.is-visible)");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 },
    );

    items.forEach((item) => observer.observe(item));
  }

  function setupMobileRsvp(partifulReady) {
    if (!partifulReady || !("IntersectionObserver" in window)) return;

    const hero = $("#top");
    const finalRsvp = $("#rsvp");
    const bar = $("#mobile-rsvp");
    let heroVisible = true;
    let finalVisible = false;

    const update = () => {
      bar.hidden = heroVisible || finalVisible;
    };

    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      update();
    }, { threshold: 0.08 }).observe(hero);

    new IntersectionObserver(([entry]) => {
      finalVisible = entry.isIntersecting;
      update();
    }, { threshold: 0.08 }).observe(finalRsvp);
  }

  function setupCountdown() {
    if (!config.eventStart) return;

    const start = new Date(config.eventStart);
    if (Number.isNaN(start.getTime())) return;

    const countdown = $("#countdown");
    countdown.hidden = false;

    const fields = {
      days: $("#countdown-days"),
      hours: $("#countdown-hours"),
      minutes: $("#countdown-minutes"),
      seconds: $("#countdown-seconds"),
    };

    let timer = null;

    function tick() {
      const difference = Math.max(0, start.getTime() - Date.now());
      const totalSeconds = Math.floor(difference / 1000);
      fields.days.textContent = String(Math.floor(totalSeconds / 86400)).padStart(2, "0");
      fields.hours.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
      fields.minutes.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      fields.seconds.textContent = String(totalSeconds % 60).padStart(2, "0");

      if (difference === 0 && timer !== null) window.clearInterval(timer);
    }

    tick();
    if (start.getTime() > Date.now()) timer = window.setInterval(tick, 1000);
  }

  applyConfig();
  applyPersonalization();
  applyPhoto();
  renderTimeline();
  setupInvitationGate();
  setupHeader();
  const partifulReady = applyExternalLinks();
  setupRevealAnimations();
  setupMobileRsvp(partifulReady);
  setupCountdown();
})();
