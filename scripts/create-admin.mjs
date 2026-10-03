// Creates the first Super Admin on a new installation (signing in with Google never creates accounts).
//   Locally:     node scripts/create-admin.mjs you@gmail.com "Your Name"
//   On server:   docker compose -f deploy/compose.yaml run --rm app node scripts/create-admin.mjs you@gmail.com "Your Name"
// Creates the Silora Academy organization if none exists. Refuses if the email is already registered.
import { PrismaClient } from "@prisma/client";

const [rawEmail, ...nameParts] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const name = nameParts.join(" ").trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
  console.error('Usage: node scripts/create-admin.mjs <google-email> "<full name>"');
  process.exit(2);
}

const db = new PrismaClient();
try {
  if (await db.user.findUnique({ where: { email } })) {
    console.error(`${email} already has an account; nothing changed.`);
    process.exit(1);
  }
  const org = (await db.organization.findFirst()) ?? (await db.organization.create({ data: { name: "Silora Academy" } }));
  const user = await db.user.create({ data: { orgId: org.id, email, name, role: "SUPER_ADMIN" } });
  await db.auditLog.create({
    data: { orgId: org.id, action: "USER_CREATED", targetType: "User", targetId: user.id, metadata: { via: "create-admin script", role: "SUPER_ADMIN" } },
  });
  console.log(`Super Admin created: ${name} <${email}>. They can now sign in with Google.`);
} finally {
  await db.$disconnect();
}
