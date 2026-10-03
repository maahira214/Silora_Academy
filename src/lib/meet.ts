/**
 * Google Meet integration.
 *
 * Every Course (Student + Teacher + Subject, or one group class) has exactly
 * one permanent Meet link that is reused for all of its lessons.
 *
 * MANUAL mode (works with free Google Meet today): a Silora staff member
 * creates the meeting from Silora's own Google account and pastes the link.
 * The app validates it and refuses to reuse a link across relationships.
 *
 * GOOGLE_API mode (needs a Google Workspace organizer account): the app
 * creates the space through the Meet REST API, adds the teacher and students
 * as members so they skip the waiting room, and reads participant data for
 * attendance. Not enabled until real Workspace credentials are configured.
 */

const MEET_URL = /^(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[/?#].*)?$/i;

export function parseMeetLink(input: string): { url: string; code: string } | null {
  const m = input.trim().match(MEET_URL);
  if (!m) return null;
  const code = m[1].toLowerCase();
  return { code, url: `https://meet.google.com/${code}` };
}

export const googleMeetApiConfigured = () =>
  Boolean(process.env.GOOGLE_MEET_ORGANIZER_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
