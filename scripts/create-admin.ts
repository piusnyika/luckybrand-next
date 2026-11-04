/**  npm run create-admin -- you@example.com "StrongPassword123"  (creates or promotes a user to admin) */
import "./load-env";
import { db, schema as s } from "../src/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/password";

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) { console.error('Usage: npm run create-admin -- email@example.com "password (8+ chars)"'); process.exit(1); }
  const e = email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(s.users.email, e) });
  const passwordHash = await hashPassword(password);
  if (existing) await db.update(s.users).set({ role: "admin", passwordHash }).where(eq(s.users.id, existing.id));
  else await db.insert(s.users).values({ email: e, username: e, passwordHash, displayName: "Admin", role: "admin" });
  console.log(`✓ ${e} is now an admin. Log in at /admin/login/`);
  process.exit(0);
})();
