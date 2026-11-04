import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { beginLogin } from "@/lib/auth";
import { finishLogin, GOOGLE_COOKIE } from "@/lib/google";
import { prisma } from "@/lib/prisma";

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

  let user = await prisma.user.findFirst({ where: { email: { equals: profile!.email, mode: "insensitive" } } });
  if (user?.blocked) fail("blocked");
  if (!user) {
    const { email, firstName, lastName, name } = profile!;
    // no password: they sign in with Google, or set one later via "Lost your password?"
    user = await prisma.user.create({ data: {
      email, username: email, passwordHash: "", firstName, lastName,
      displayName: name || `${firstName} ${lastName}`.trim() || email.split("@")[0], role: "customer", emailVerifiedAt: new Date(),
    } });
  } else if (!user.firstName && !user.lastName && (profile!.firstName || profile!.lastName)) {
    await prisma.user.update({ where: { id: user.id }, data: { firstName: profile!.firstName, lastName: profile!.lastName } });
  }
  // Google has confirmed the address
  if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), verifyToken: null } });
  redirect(await beginLogin(user.id, true, saved.next || "/my-account/"));
}
