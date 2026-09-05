const RSVP_HEADERS = [
  "RSVP ID",
  "Family",
  "Status",
  "Number attending",
  "Email",
  "Phone",
  "Dietary or accessibility needs",
  "Message",
  "Responded at",
  "Updated at",
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("RSVP sync")
    .addItem("Configure", "configureRsvpSync")
    .addToUi();
}

function configureRsvpSync() {
  const ui = SpreadsheetApp.getUi();
  const secretResult = ui.prompt("RSVP sync", "Paste the shared Sheet secret.", ui.ButtonSet.OK_CANCEL);
  if (secretResult.getSelectedButton() !== ui.Button.OK) return;

  const emailResult = ui.prompt(
    "RSVP sync",
    "Enter the host email for RSVP alerts, or leave it blank.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (emailResult.getSelectedButton() !== ui.Button.OK) return;

  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId(),
    SHEET_NAME: "RSVP Responses",
    WEBHOOK_SECRET: secretResult.getResponseText().trim(),
    HOST_EMAIL: emailResult.getResponseText().trim(),
  });
  ui.alert("RSVP sync is configured. Deploy this script as a web app next.");
}

function doPost(event) {
  try {
    const input = JSON.parse(event.postData.contents || "{}");
    const settings = PropertiesService.getScriptProperties().getProperties();
    if (!settings.WEBHOOK_SECRET || input.secret !== settings.WEBHOOK_SECRET) return jsonOutput({ ok: false });
    if (!input.record || !input.record.id || !input.record.responded_at) return jsonOutput({ ok: true, ignored: true });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(settings.SPREADSHEET_ID);
      const sheet = getResponseSheet(spreadsheet, settings.SHEET_NAME || "RSVP Responses");
      const row = rsvpRow(input.record);
      const existingRow = findRsvpRow(sheet, input.record.id);
      const targetRow = existingRow || sheet.getLastRow() + 1;
      sheet.getRange(targetRow, 1, 1, RSVP_HEADERS.length).setValues([row]);
    } finally {
      lock.releaseLock();
    }

    if (settings.HOST_EMAIL) sendHostEmail(settings.HOST_EMAIL, input.record);
    return jsonOutput({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonOutput({ ok: false });
  }
}

function getResponseSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, RSVP_HEADERS.length);
  }
  return sheet;
}

function findRsvpRow(sheet, rsvpId) {
  if (sheet.getLastRow() < 2) return 0;
  const match = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(rsvpId))
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function rsvpRow(record) {
  return [
    safeCell(record.id),
    safeCell(record.response_name || record.family_label || "Guest"),
    record.attending ? "Attending" : "Declined",
    record.attending ? Number(record.party_size || 1) : 0,
    safeCell(record.response_email || ""),
    safeCell(record.response_phone || ""),
    safeCell(record.dietary_notes || ""),
    safeCell(record.message || ""),
    safeCell(record.responded_at || ""),
    safeCell(record.updated_at || ""),
  ];
}

function safeCell(value) {
  const text = String(value == null ? "" : value).slice(0, 2000);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function sendHostEmail(email, record) {
  const family = safeCell(record.response_name || record.family_label || "Guest");
  const status = record.attending ? `${Number(record.party_size || 1)} attending` : "cannot attend";
  MailApp.sendEmail({
    to: email,
    subject: `RSVP: ${family}`,
    body: `${family}: ${status}.\n\nOpen the RSVP Responses tab in the planning spreadsheet for details.`,
  });
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
