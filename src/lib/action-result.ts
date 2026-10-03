import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ForbiddenError } from "@/lib/authz";

export type ActionResult = { ok?: boolean; error?: string; message?: string };

/**
 * Wraps a server action body so expected failures become a friendly message
 * instead of a crash. Navigation (redirect/notFound) is re-thrown untouched.
 */
export async function runAction(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (isNavigation(e)) throw e;
    if (e instanceof ForbiddenError) return { error: e.message };
    if (e instanceof UserError) return { error: e.message };
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Please check the form." };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That already exists (duplicate value)." };
    }
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
}

/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

function isNavigation(e: unknown) {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
