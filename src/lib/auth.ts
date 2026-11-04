import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const COOKIE = "lb_session";
const secret = () => {
  const v = process.env.AUTH_SECRET || "";
  // a guessable secret would let anyone forge an admin login, so production refuses to run without a real one
  if (process.env.NODE_ENV === "production" && (v.length < 32 || v.startsWith("change-me"))) throw new Error("AUTH_SECRET must be a long random value (32+ characters)");
  return new TextEncoder().encode(v || "dev-only-insecure-secret-change-me");
};

export async function createSession(userId: number, remember = true) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  (await cookies()).delete(PENDING);
  const token = await new SignJWT({ uid: userId, sv: u?.sessionVersion ?? 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(remember ? "30d" : "1d").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

/* ---------- two-step login ---------- */
const PENDING = "lb_2fa";

/**
 * Logs a user in after their password (or Google, or a reset link) checked out. Accounts with two-step login
 * get a 10-minute "code pending" cookie instead and are sent to /admin/two-step/. Returns the URL to go to.
 */
export async function beginLogin(userId: number, remember: boolean, next: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, sessionVersion: true } });
  if (!u?.totpSecret) { await createSession(userId, remember); return next; }
  const token = await new SignJWT({ uid: userId, sv: u.sessionVersion, rem: remember, next, p: "2fa" }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("10m").sign(secret());
  (await cookies()).set(PENDING, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return "/admin/two-step/";
}

/** The login waiting for its two-step code, if any */
export async function pendingLogin() {
  const token = (await cookies()).get(PENDING)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.p !== "2fa") return null;
    const next = String(payload.next || "/");
    return { userId: Number(payload.uid), sessionVersion: Number(payload.sv ?? 0), remember: !!payload.rem, next: next.startsWith("/") && !next.startsWith("//") ? next : "/" };
  } catch { return null; }
}
export async function clearPendingLogin() { (await cookies()).delete(PENDING); }

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = await prisma.user.findUnique({ where: { id: Number(payload.uid) } });
    // blocked or password changed: signed out everywhere
    return u && !u.blocked && Number(payload.sv ?? 0) === u.sessionVersion ? u : null;
  } catch { return null; }
});
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(next = "/my-account/") {
  const u = await getCurrentUser();
  if (!u) redirect("/my-account/?next=" + encodeURIComponent(next));
  return u;
}
export async function requireStaff() {
  const u = await getCurrentUser();
  if (!u || (u.role !== "admin" && u.role !== "manager")) redirect("/admin/login/");
  return u;
}
export async function requireAdmin() {
  const u = await requireStaff();
  if (u.role !== "admin") redirect("/admin/");
  return u;
}
