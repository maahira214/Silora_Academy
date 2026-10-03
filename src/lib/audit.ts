import "server-only";
import { headers } from "next/headers";
import type { AuditResult, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";

type AuditInput = {
  orgId: string;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  result?: AuditResult;
  metadata?: Prisma.InputJsonValue;
};

export async function audit(input: AuditInput) {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip = clientIp(h);
    userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    // called outside a request (worker) — no request metadata
  }
  await db.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      result: input.result ?? "SUCCESS",
      metadata: input.metadata,
      ip,
      userAgent,
    },
  });
}
