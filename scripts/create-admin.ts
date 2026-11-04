/**  npm run create-admin -- you@example.com "StrongPassword123"  (creates or promotes a user to admin) */
import "./load-env";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { hashPassword } from "../src/lib/password";

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) { console.error('Usage: npm run create-admin -- email@example.com "password (8+ chars)"'); process.exit(1); }
  const e = email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email: { equals: e, mode: "insensitive" } } });
  const passwordHash = await hashPassword(password);
  if (existing) await prisma.user.update({ where: { id: existing.id }, data: { role: "admin", passwordHash } });
  else await prisma.user.create({ data: { email: e, username: e, passwordHash, displayName: "Admin", role: "admin" } });
  console.log(`✓ ${e} is now an admin. Log in at /admin/login/`);
  process.exit(0);
})();
