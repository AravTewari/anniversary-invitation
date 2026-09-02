(function () {
  "use strict";

  const config = window.INVITATION_CONFIG;
  const INVITE_TOKEN_KEY = "anniversary-rsvp-token";

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

  function clampInteger(value, minimum, maximum, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function normalizeInviteToken(value) {
    const token = cleanText(value).toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token)
      ? token
      : "";
  }

  function readSessionToken() {
    try {
      return normalizeInviteToken(window.sessionStorage.getItem(INVITE_TOKEN_KEY));
    } catch {
      return "";
    }
  }

  function storeSessionToken(token) {
    try {
      if (token) window.sessionStorage.setItem(INVITE_TOKEN_KEY, token);
      else window.sessionStorage.removeItem(INVITE_TOKEN_KEY);
    } catch {
      // Storage can be unavailable in private browsing. The invitation still works.
    }
  }

  function captureInviteToken() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);
    const hashHasToken = hashParams.has("invite");
    const queryHasToken = queryParams.has("invite");
    const suppliedToken = hashParams.get("invite") ?? queryParams.get("invite");

    if (!hashHasToken && !queryHasToken) {
      storeSessionToken("");
      return { token: "", invalid: false };
    }

    const token = normalizeInviteToken(suppliedToken);
    storeSessionToken(token);
    queryParams.delete("invite");

    const nextQuery = queryParams.toString();
    const nextHash = token ? `#invite=${token}` : hashHasToken ? "#top" : window.location.hash;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${nextHash}`,
    );

    return { token, invalid: !token };
  }

  function setupPrivateAnchorNavigation() {
    document.addEventListener("click", (event) => {
      if (!readSessionToken()) return;

      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link) return;

      const targetId = link.getAttribute("href").slice(1);
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      event.preventDefault();
      if (link.classList.contains("skip-link")) target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function getLegacyFamily() {
    const fragmentFamily = new URLSearchParams(window.location.hash.slice(1)).get("family");
    const queryFamily = new URLSearchParams(window.location.search).get("family");
    return cleanText(fragmentFamily ?? queryFamily, config.defaultFamily).slice(0, 80);
  }

  function setFamilyGreeting(family) {
    const safeFamily = cleanText(family, config.defaultFamily).slice(0, 80);
    $("#personal-greeting").textContent = `Dear ${safeFamily},`;
    $("#gate-family").textContent =
      safeFamily === config.defaultFamily ? "Open your invitation" : `Open for ${safeFamily}`;
  }

  function isSafeLinkUrl(value, allowedHosts) {
    if (!value) return false;

    try {
      const parsed = new URL(value, window.location.href);
      if (parsed.origin === window.location.origin) return true;
      if (parsed.protocol !== "https:") return false;
      return !allowedHosts || allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }

  function getRsvpApiConfig() {
    const rsvp = config.rsvp || {};
    const url = cleanText(rsvp.supabaseUrl).replace(/\/$/, "");
    const key = cleanText(rsvp.publishableKey);
    const lookupFunction = cleanText(rsvp.lookupFunction, "get_invite");
    const submitFunction = cleanText(rsvp.submitFunction, "submit_rsvp");

    try {
      const parsed = new URL(url);
      const validFunctionNames = /^[a-z][a-z0-9_]*$/;
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname.endsWith(".supabase.co") ||
        key.length < 20 ||
        !validFunctionNames.test(lookupFunction) ||
        !validFunctionNames.test(submitFunction)
      ) {
        return null;
      }
    } catch {
      return null;
    }

    return { url, key, lookupFunction, submitFunction };
  }

  async function callRsvpFunction(api, functionName, payload) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await window.fetch(`${api.url}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          apikey: api.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(cleanText(body.message, "We could not save your response. Please try again."));
      }

      return body;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("The RSVP service took too long to respond. Please try again.");
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
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

    document.title = `${config.yearsTogether} Years of Love | ${config.couple.partner1} & ${config.couple.partner2}`;
  }

  function applyPersonalization() {
    const family = getLegacyFamily();
    setFamilyGreeting(family);
    return family;
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
      if (!isSafeLinkUrl(url)) return;
      link.href = new URL(url, window.location.href).href;
      link.hidden = false;
      link.rel = "noopener noreferrer";
    });

    $$('[data-rsvp-link]').forEach((link) => {
      link.href = "#rsvp";
      link.removeAttribute("aria-disabled");
      link.classList.remove("is-disabled");
    });
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

      content.append(title);
      const descriptionText = cleanText(item.description);
      if (descriptionText) {
        const description = document.createElement("p");
        description.textContent = descriptionText;
        content.append(description);
      }
      row.append(time, content);
      timeline.append(row);
    });
  }

  function setupBackgroundMusic() {
    const audio = $("#background-music");
    const initialVolume = 0.16;
    const fadeStart = 42;
    const fadeEnd = 50;

    audio.addEventListener("timeupdate", () => {
      if (audio.currentTime < fadeStart) return;
      const progress = Math.min(1, (audio.currentTime - fadeStart) / (fadeEnd - fadeStart));
      audio.volume = initialVolume * (1 - progress);

      if (progress === 1) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = initialVolume;
      }
    });

    function play() {
      audio.currentTime = 0;
      audio.volume = initialVolume;

      try {
        Promise.resolve(audio.play()).catch(() => {});
      } catch {
        // Playback can be blocked by the browser. The invitation still works.
      }
    }

    return {
      start: play,
    };
  }

  function setupInvitationGate(onOpen) {
    const gate = $("#invitation-gate");
    const openButton = $("#open-invitation");
    const main = $("#main-content");
    const backgroundElements = [$("#site-header"), main, $("footer")].filter(Boolean);

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
      }, 380);
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
    openButton.addEventListener("click", () => {
      onOpen();
      openInvitation(true);
    });
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

  async function setupRsvpForm(initialFamily, capturedInvite) {
    const form = $("#rsvp-form");
    const submitButton = $("#rsvp-submit");
    const status = $("#rsvp-status");
    const inviteContext = $("#invite-context");
    const inviteContextCopy = $("#invite-context-copy");
    const useGeneralButton = $("#use-general-form");
    const nameInput = $("#response-name");
    const emailInput = $("#response-email");
    const phoneInput = $("#response-phone");
    const partySizeField = $("#party-size-field");
    const partySizeInput = $("#party-size");
    const partySizeHint = $("#party-size-hint");
    const emailOptIn = $("#email-opt-in");
    const smsOptIn = $("#sms-opt-in");
    const api = getRsvpApiConfig();
    const generalMax = clampInteger(config.rsvp?.generalMaxPartySize, 1, 7, 7);
    let currentToken = capturedInvite.token;
    let currentMax = generalMax;

    function setStatus(message, type = "") {
      const safeMessage = cleanText(message);
      status.hidden = !safeMessage;
      status.textContent = safeMessage;
      status.classList.toggle("is-success", type === "success");
      status.classList.toggle("is-error", type === "error");
    }

    function setInviteContext(message, allowSwitch = true) {
      const safeMessage = cleanText(message);
      inviteContext.hidden = !safeMessage;
      inviteContextCopy.textContent = safeMessage;
      useGeneralButton.hidden = !allowSwitch;
    }

    function setPartyLimit(maximum) {
      currentMax = clampInteger(maximum, 1, 7, generalMax);
      partySizeInput.max = String(currentMax);
      partySizeHint.textContent = `Include yourself. Up to ${currentMax} ${currentMax === 1 ? "guest" : "guests"}.`;
    }

    function setAttendance(value) {
      const attendingYes = value === true;
      const attendingNo = value === false;
      $$('input[name="attending"]', form).forEach((radio) => {
        radio.checked = (radio.value === "yes" && attendingYes) || (radio.value === "no" && attendingNo);
      });
      partySizeField.hidden = !attendingYes;
      partySizeInput.disabled = !attendingYes;
      partySizeInput.required = attendingYes;
      if (attendingYes && !partySizeInput.value) partySizeInput.value = "1";
      if (!attendingYes) partySizeInput.value = "";
    }

    function populateForm(values = {}) {
      nameInput.value = cleanText(values.name);
      emailInput.value = cleanText(values.email);
      phoneInput.value = cleanText(values.phone);
      $("#dietary-notes").value = typeof values.dietaryNotes === "string" ? values.dietaryNotes.slice(0, 500) : "";
      $("#guest-message").value = typeof values.message === "string" ? values.message.slice(0, 1000) : "";
      emailOptIn.checked = Boolean(values.emailOptIn);
      smsOptIn.checked = Boolean(values.smsOptIn);
      setAttendance(typeof values.attending === "boolean" ? values.attending : null);
      if (values.attending === true && Number.isFinite(Number(values.partySize))) {
        partySizeInput.value = String(clampInteger(values.partySize, 1, currentMax, 1));
      }
    }

    function validateContact() {
      emailInput.setCustomValidity("");
      phoneInput.setCustomValidity("");

      if (!emailInput.value.trim() && !phoneInput.value.trim()) {
        emailInput.setCustomValidity("Enter an email address or mobile phone number.");
        return false;
      }
      if (emailOptIn.checked && !emailInput.value.trim()) {
        emailInput.setCustomValidity("Enter an email address to receive email updates.");
        return false;
      }
      if (smsOptIn.checked && !phoneInput.value.trim()) {
        phoneInput.setCustomValidity("Enter a mobile phone number to receive text updates.");
        return false;
      }
      return true;
    }

    function useGeneralForm() {
      currentToken = "";
      storeSessionToken("");
      currentMax = generalMax;
      form.reset();
      setPartyLimit(generalMax);
      setAttendance(null);
      setInviteContext("");
      setFamilyGreeting(config.defaultFamily);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#rsvp`);
      submitButton.firstChild.textContent = "Send RSVP ";
      setStatus("");
      nameInput.focus({ preventScroll: true });
    }

    setPartyLimit(generalMax);
    setAttendance(null);

    if (!currentToken && initialFamily !== config.defaultFamily) {
      nameInput.value = initialFamily;
    }

    $$('input[name="attending"]', form).forEach((radio) => {
      radio.addEventListener("change", () => setAttendance(radio.value === "yes"));
    });
    [emailInput, phoneInput, emailOptIn, smsOptIn].forEach((element) => {
      element.addEventListener("input", () => {
        emailInput.setCustomValidity("");
        phoneInput.setCustomValidity("");
      });
    });
    useGeneralButton.addEventListener("click", useGeneralForm);

    if (!api) {
      submitButton.disabled = true;
      setStatus("The private RSVP form is being connected. Please check back soon.", "error");
    } else if (capturedInvite.invalid) {
      setStatus("This personal invitation link is not valid. You can still use the form below.", "error");
    } else if (currentToken) {
      submitButton.disabled = true;
      setInviteContext("Loading your personal invitation…", false);

      try {
        const invitation = await callRsvpFunction(api, api.lookupFunction, { p_token: currentToken });
        if (!invitation || !invitation.found) {
          currentToken = "";
          storeSessionToken("");
          setInviteContext("");
          setStatus("We could not find that personal invitation. You can still use the form below.", "error");
        } else {
          const familyLabel = cleanText(invitation.familyLabel, config.defaultFamily);
          setFamilyGreeting(familyLabel);
          setPartyLimit(invitation.maxPartySize);
          populateForm(invitation.form || { name: familyLabel });
          setInviteContext(`Personal invitation for ${familyLabel} · Up to ${currentMax} ${currentMax === 1 ? "guest" : "guests"}`);
          if (invitation.hasResponded) submitButton.firstChild.textContent = "Update RSVP ";
        }
      } catch (error) {
        setInviteContext("We could not load the saved details for this invitation.");
        setStatus(error.message, "error");
      } finally {
        submitButton.disabled = false;
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("");

      if (!api) {
        setStatus("The private RSVP form is not connected yet. Please contact the host.", "error");
        return;
      }

      validateContact();
      if (!form.reportValidity()) return;

      const attendingValue = new FormData(form).get("attending");
      const attending = attendingValue === "yes";
      const payload = {
        p_token: currentToken || "",
        p_name: nameInput.value,
        p_email: emailInput.value,
        p_phone: phoneInput.value,
        p_attending: attending,
        p_party_size: attending ? Number.parseInt(partySizeInput.value, 10) : 0,
        p_dietary_notes: $("#dietary-notes").value,
        p_message: $("#guest-message").value,
        p_email_opt_in: emailOptIn.checked,
        p_sms_opt_in: smsOptIn.checked,
        p_website: $("#website").value,
      };

      submitButton.disabled = true;
      form.setAttribute("aria-busy", "true");
      submitButton.firstChild.textContent = "Saving… ";

      try {
        const result = await callRsvpFunction(api, api.submitFunction, payload);
        if (!result || !result.ok) throw new Error("We could not save your response. Please try again.");

        currentToken = normalizeInviteToken(result.inviteToken) || currentToken;
        storeSessionToken(currentToken);
        if (currentToken) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}#invite=${currentToken}`,
          );
        }
        setFamilyGreeting(nameInput.value);
        setStatus(
          attending
            ? `Thank you. We saved your RSVP for ${payload.p_party_size} ${payload.p_party_size === 1 ? "guest" : "guests"}.`
            : "Thank you. We saved your response and will miss you at the celebration.",
          "success",
        );
        setInviteContext(`Saved response for ${cleanText(nameInput.value)}`);
        submitButton.firstChild.textContent = "Update RSVP ";
      } catch (error) {
        setStatus(error.message, "error");
        submitButton.firstChild.textContent = "Send RSVP ";
      } finally {
        submitButton.disabled = false;
        form.removeAttribute("aria-busy");
      }
    });
  }

  const capturedInvite = captureInviteToken();
  setupPrivateAnchorNavigation();
  applyConfig();
  const initialFamily = applyPersonalization();
  applyPhoto();
  renderTimeline();
  const backgroundMusic = setupBackgroundMusic();
  setupInvitationGate(backgroundMusic.start);
  setupHeader();
  applyExternalLinks();
  setupRevealAnimations();
  setupRsvpForm(initialFamily, capturedInvite);
})();
