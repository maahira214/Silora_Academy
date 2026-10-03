/**
 * Detects likely attempts to exchange personal contact details in chat.
 * It is a deterrent plus an audit trigger, not a guarantee — Silora decides
 * what happens on a match through Organization.contactPolicy.
 */

export type ContactFinding = "PHONE_NUMBER" | "EMAIL" | "MESSAGING_APP" | "SOCIAL_HANDLE" | "CONTACT_REQUEST";

const EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}/i;

// Messaging/social apps and their link shorteners
const MESSAGING = /\b(whats\s*app|whatsapp|wa\.me|watsapp|telegram|t\.me|signal|viber|imo|wechat|line\s+app|skype|discord|snap\s*chat|snapchat|insta(?:gram)?|ig\s+id|facebook|fb\s+id|messenger|zoom\.us|teams\.microsoft)\b/i;

const SOCIAL_HANDLE = /(^|\s)@[a-z0-9_.]{3,}/i;

const CONTACT_REQUEST =
  /\b(call|text|ping|dm|message|contact|reach)\s+me\b|\bmy\s+(number|no\.?|mobile|phone|cell|contact|email|mail|id)\b|\b(send|share|give)\s+(me\s+)?(your|ur)\s+(number|no\.?|mobile|phone|contact|email|id)\b|\bnumber\s+(is|=)\b/i;

const WORD_DIGITS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", double: "",
};

/** Phone numbers: 8+ digits once spaces, dashes, dots, brackets and spelled-out digits are removed. */
function hasPhoneNumber(text: string) {
  const spelled = text
    .toLowerCase()
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => WORD_DIGITS[w]);
  // Runs of digits allowing common separators between them
  const runs = spelled.match(/\+?\d[\d\s().\-–]{6,}\d/g) ?? [];
  return runs.some((run) => {
    const digits = run.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return false;
    // Ignore things that are obviously not phone numbers: years/ranges like 2024-2025, times
    if (/^(19|20)\d{2}(19|20)\d{2}$/.test(digits)) return false;
    return true;
  });
}

export function detectContactInfo(text: string): ContactFinding[] {
  const findings = new Set<ContactFinding>();
  if (hasPhoneNumber(text)) findings.add("PHONE_NUMBER");
  if (EMAIL.test(text)) findings.add("EMAIL");
  if (MESSAGING.test(text)) findings.add("MESSAGING_APP");
  if (SOCIAL_HANDLE.test(text)) findings.add("SOCIAL_HANDLE");
  if (CONTACT_REQUEST.test(text)) findings.add("CONTACT_REQUEST");
  return [...findings];
}

export const FINDING_LABELS: Record<ContactFinding, string> = {
  PHONE_NUMBER: "Phone number",
  EMAIL: "Email address",
  MESSAGING_APP: "External messaging/social app",
  SOCIAL_HANDLE: "Social media handle",
  CONTACT_REQUEST: "Request for personal contact",
};
