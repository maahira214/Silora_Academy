import { vi } from "vitest";

// The server code runs outside a web request here, so stand in for the request-only parts.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

/** The session cookie the next "request" carries; set with signInAs() in helpers.ts. */
export const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
  headers: async () => new Headers({ "user-agent": "silora-security-tests", "x-forwarded-for": "203.0.113.7" }),
}));
