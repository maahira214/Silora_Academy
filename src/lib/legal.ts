/**
 * Privacy policy, consent and parent-consent text, in one place.
 *
 * DRAFT for Silora Academy to approve (and, if it chooses, to have reviewed by a lawyer).
 * Every statement describes what this software actually does; if the app changes, update
 * this text and bump POLICY_VERSION so everyone is asked to agree again.
 *
 * Items marked CONFIRM in LEGAL below are decisions only Silora can make.
 */

/** Changing this asks every teacher and student to read and agree again. */
export const POLICY_VERSION = "2026-10-09";

export const LEGAL = {
  academy: "Silora Academy",
  website: "siloraacademy.com",
  /** CONFIRM: an inbox Silora reads for privacy questions and requests. */
  privacyEmail: "privacy@siloraacademy.com",
  /** CONFIRM: the person responsible for privacy complaints (grievance officer). */
  grievanceOfficer: "the Silora Academy privacy contact",
  /** CONFIRM: how quickly Silora answers privacy requests. */
  responseDays: 30,
  lastUpdated: "9 October 2026",
};

export type Section = { id: string; title: string; paragraphs?: string[]; bullets?: string[]; table?: [string, string][] };

/** How long each kind of information is kept (proposed; Silora to confirm). */
export const RETENTION: [string, string][] = [
  ["Messages and files in class chats", "While the class is running, then 1 year after the class ends"],
  ["Class schedules, attendance and lesson records", "3 years"],
  ["Security records (sign-ins, who did what)", "2 years"],
  ["Copies of emails we sent you", "1 year"],
  ["Signed-in sessions", "Ends after 30 days without use, or when you sign out"],
  ["Database backups", "30 days, then overwritten"],
  ["Your account after you leave Silora", "Personal details removed 1 year after your account is closed, or sooner if you ask"],
];

export const PRIVACY_SECTIONS: Section[] = [
  {
    id: "summary",
    title: "The short version",
    bullets: [
      "We use your information only to run your classes: scheduling, joining Google Meet, messages and support.",
      "Teachers and students never see each other's phone number or email address.",
      "We don't sell your information, show ads or track you for marketing.",
      "Messages are checked automatically for phone numbers and other contact details, to keep everyone safe and on Silora.",
      "For students under 18, a parent or guardian must agree before the account is created.",
      `You can ask to see, correct or delete your information by writing to ${LEGAL.privacyEmail}.`,
    ],
  },
  {
    id: "collect",
    title: "What we collect",
    bullets: [
      "Account details Silora enters for you: your name, the Google (Gmail) address you sign in with, your phone number, your time zone. For teachers, the title shown to students. For students, grade, school board and a parent or guardian's name, phone and email.",
      "From Google when you sign in: your name, email address and a Google account ID. We never see your Google password, contacts, Drive or other Google data.",
      "Your classes: which classes you are in, lesson times, when you pressed Join class, and how each lesson ended (for example, finished or cancelled).",
      "Messages and files you send in Silora chats, and any Need help? requests.",
      "Security records: when you sign in, the internet (IP) address and type of browser or device used, and important actions such as joining a class or downloading a file.",
      "Copies of the emails we send you about class changes.",
      "Error reports when something breaks. These contain technical details only; we have set them up to leave out names, email addresses, IP addresses and cookies.",
    ],
  },
  {
    id: "classes",
    title: "Google Meet and your classes",
    paragraphs: [
      "Classes happen in Google Meet. Silora checks that you belong to a class, records that you joined, and then opens that class's Meet room. Silora does not record video or audio from your classes.",
      "Inside Google Meet, Google's own privacy policy applies. Use the same Google account you sign in to Silora with.",
    ],
  },
  {
    id: "use",
    title: "How we use it",
    bullets: [
      "To schedule your classes, remind you about them and let you join.",
      "To let teachers and students message each other without sharing personal contact details.",
      "To notice problems quickly, for example a teacher who hasn't joined, and to help when you ask.",
      "To keep the service safe: preventing misuse, investigating reports and keeping records of important actions.",
      "To email you when a class is added, moved or cancelled.",
    ],
    paragraphs: ["We do not use your information for advertising, and we do not build profiles of students for any purpose other than running their classes."],
  },
  {
    id: "messages",
    title: "Messages, and when Silora can read them",
    bullets: [
      "Messages are stored so the conversation is there next time and so problems can be looked into.",
      "Messages are checked automatically for phone numbers, email addresses, social media handles and requests to talk outside Silora. Depending on Silora's setting, the sender is warned, the message is blocked, or it is held for review. Each flagged message is recorded.",
      "Silora's operations staff cannot read conversations.",
      "A small number of Silora administrators can open a conversation to review it: when a message has been flagged, when someone reports a problem, or to keep a student safe. Every time they do, it is recorded.",
      "When a class ends or a teacher is changed, the old conversation becomes read-only.",
      "To report a message or a person, tap Need help? in the app or write to us.",
    ],
  },
  {
    id: "who",
    title: "Who can see your information",
    bullets: [
      "Teachers and students in the same class see each other's name (and the teacher's title), never phone numbers or email addresses.",
      "Silora staff see what they need to run classes: account details, class schedules, attendance and help requests.",
      "Service providers who run parts of Silora for us, only to provide that part: Google (sign-in and Google Meet), Amazon Web Services (our server, in Mumbai, India), Cloudflare (storage for chat files and backups, in the Asia-Pacific region), Resend (sending emails) and Sentry (error reports, technical details only).",
      "Authorities, only when the law requires it.",
    ],
    paragraphs: ["We never sell or rent your information."],
  },
  {
    id: "keep",
    title: "How long we keep it",
    table: RETENTION,
  },
  {
    id: "children",
    title: "Students under 18",
    bullets: [
      "Silora creates a student account only after a parent or guardian has agreed to this policy. Silora records when and how they agreed.",
      "We don't show ads to students, track their behaviour for marketing, or build profiles of them beyond what their classes need.",
      `A parent or guardian can ask to see, correct or delete their child's information, or withdraw their consent, by writing to ${LEGAL.privacyEmail}. If consent is withdrawn, the student's account is closed.`,
    ],
  },
  {
    id: "rights",
    title: "Your choices and rights",
    bullets: [
      "See the information we hold about you, and get a copy.",
      "Correct anything that is wrong.",
      "Ask us to delete your information. Some records, such as security records, may need to be kept for a while, as listed above.",
      "Withdraw your consent. You can then no longer use Silora, and we close your account.",
      "Name someone who can use these rights for you if you are unable to.",
      `Complain to ${LEGAL.grievanceOfficer} at ${LEGAL.privacyEmail}. We reply within ${LEGAL.responseDays} days. If you are not satisfied, you can complain to the Data Protection Board of India.`,
    ],
  },
  {
    id: "security",
    title: "How we protect it",
    bullets: [
      "Every page and file checks, on our server, that you are allowed to see it.",
      "All connections use HTTPS encryption. Chat files are private and are only opened through Silora.",
      "Staff only get the access their job needs, and important actions are recorded.",
      "Backups are taken every night so information isn't lost.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    paragraphs: [
      "Silora uses one cookie to keep you signed in, and two short-lived cookies during Google sign-in. We don't use advertising or tracking cookies.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    paragraphs: [
      "If we change this policy in an important way, we will ask you to read and agree again the next time you sign in. The date at the top shows the latest version.",
    ],
  },
];

/** The few points shown before someone agrees, linking to the full policy. */
export const CONSENT_POINTS = [
  "Silora uses your information only to run your classes, messages and support.",
  "Teachers and students never see each other's phone number or email.",
  "Messages are checked for phone numbers and other contact details. Flagged messages can be reviewed by Silora, and every review is recorded.",
  "Keep all communication on Silora. Don't share phone numbers, WhatsApp, email or social media.",
  "Silora does not record video or audio from your classes.",
];

/** Text for parents and guardians of students under 18 (send it, then record their answer). */
export const PARENT_CONSENT = {
  title: "Parent or guardian consent",
  intro: `${LEGAL.academy} uses an online platform for classes, Google Meet links and messages between your child and their teacher. Because your child is under 18, we need your consent before we create their account.`,
  points: [
    "We will store your child's name, Google (Gmail) address, grade and board, and your name, phone number and email address.",
    "Your child will join classes through Silora, which opens Google Meet. Silora does not record video or audio.",
    "Your child can message their teacher, and send photos and documents, inside Silora. Phone numbers and other contact details are never shown to the teacher, and messages that contain them are flagged.",
    "Silora administrators may review a conversation if a message is flagged, if someone reports a problem, or to keep your child safe. Every review is recorded.",
    "We don't sell your child's information, show them ads or track them for marketing.",
    `You can ask to see, correct or delete your child's information, or withdraw this consent, at any time by writing to ${LEGAL.privacyEmail}.`,
  ],
  agreement: `I am the parent or legal guardian of the student named below. I have read the Silora Academy privacy policy and I agree to ${LEGAL.academy} creating an account for my child and using their information as described.`,
  fields: ["Student's name", "Parent or guardian's name", "Relationship to the student", "Phone number", "Email address", "Date", "Signature (or reply “I agree” by email)"],
};
