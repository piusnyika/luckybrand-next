import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { createSession } from "@/lib/auth";
import { finishLogin, GOOGLE_COOKIE } from "@/lib/google";

/** Google redirects back here. Logs in the account with that (Google-verified) email, or creates one. */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const saved = (() => { try { return JSON.parse(jar.get(GOOGLE_COOKIE)?.value || ""); } catch { return null; } })();
  jar.delete({ name: GOOGLE_COOKIE, path: "/api/auth/google/" });
  const sp = req.nextUrl.searchParams;
  const fail = (code: string) => redirect(`/my-account/?google_error=${code}${saved?.next && saved.next !== "/my-account/" ? `&next=${encodeURIComponent(saved.next)}` : ""}`);

  if (sp.get("error")) fail(sp.get("error") === "access_denied" ? "cancelled" : "failed");
  if (!saved || !sp.get("code") || sp.get("state") !== saved.state) fail("expired");

  let profile;
  try { profile = await finishLogin(req.nextUrl.origin, sp.get("code")!, saved.verifier, saved.nonce); }
  catch (e: any) { console.error("Google login:", e?.message || e); fail(e?.message === "unverified" ? "unverified" : "failed"); }

  let user = await db.query.users.findFirst({ where: eq(s.users.email, profile!.email) });
  if (user?.blocked) fail("blocked");
  if (!user) {
    const { email, firstName, lastName, name } = profile!;
    // no password: they sign in with Google, or set one later via "Lost your password?"
    const [r] = await db.insert(s.users).values({
      email, username: email, passwordHash: "", firstName, lastName,
      displayName: name || `${firstName} ${lastName}`.trim() || email.split("@")[0], role: "customer",
    }).$returningId();
    user = (await db.query.users.findFirst({ where: eq(s.users.id, r.id) }))!;
  } else if (!user.firstName && !user.lastName && (profile!.firstName || profile!.lastName)) {
    await db.update(s.users).set({ firstName: profile!.firstName, lastName: profile!.lastName }).where(eq(s.users.id, user.id));
  }
  await createSession(user.id);
  redirect(saved.next || "/my-account/");
}
