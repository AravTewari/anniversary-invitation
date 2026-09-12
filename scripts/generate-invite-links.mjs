import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const inputPath = process.argv[2];
const siteUrl = (process.argv[3] || "https://aravtewari.github.io/anniversary-invitation/").replace(/\/$/, "");

if (!inputPath) {
  console.error("Usage: node scripts/generate-invite-links.mjs <invite-families.csv> [site-url]");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted && character === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

const input = parseCsv(await fs.readFile(inputPath, "utf8"));
const headers = input.shift()?.map((header) => header.trim()) || [];
const requiredHeaders = ["family_label", "expected_email", "expected_phone", "planning_status"];

for (const requiredHeader of requiredHeaders) {
  if (!headers.includes(requiredHeader)) {
    throw new Error(`Missing required column: ${requiredHeader}`);
  }
}

const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
const records = input
  .map((row) => ({
    familyLabel: String(row[headerIndex.family_label] || "").trim(),
    expectedEmail: String(row[headerIndex.expected_email] || "").trim().toLowerCase(),
    expectedPhone: String(row[headerIndex.expected_phone] || "").trim(),
    planningStatus: String(row[headerIndex.planning_status] || "").trim(),
    inviteToken: String(row[headerIndex.invite_token] || "").trim() || crypto.randomUUID(),
  }))
  .filter((record) => record.familyLabel);

const tokens = new Set(records.map((record) => record.inviteToken));
if (tokens.size !== records.length) throw new Error("Invite tokens must be unique.");

const importRows = [
  ["invite_token", "source", "family_label", "expected_email", "expected_phone", "planning_status"],
  ...records.map((record) => [
    record.inviteToken,
    "personalized",
    record.familyLabel,
    record.expectedEmail,
    record.expectedPhone,
    record.planningStatus,
  ]),
];

const linkRows = [
  ["family_label", "expected_email", "expected_phone", "custom_link"],
  ...records.map((record) => [
    record.familyLabel,
    record.expectedEmail,
    record.expectedPhone,
    `${siteUrl}/#invite=${record.inviteToken}`,
  ]),
];

const parsedPath = path.parse(inputPath);
const importPath = path.join(parsedPath.dir, `${parsedPath.name}.supabase.csv`);
const linksPath = path.join(parsedPath.dir, `${parsedPath.name}.links.csv`);

await Promise.all([
  fs.writeFile(importPath, toCsv(importRows), { mode: 0o600 }),
  fs.writeFile(linksPath, toCsv(linkRows), { mode: 0o600 }),
]);

console.log(`Created ${records.length} private invitation records.`);
console.log(importPath);
console.log(linksPath);
