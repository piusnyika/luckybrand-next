import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";

const COOKIE = "lb_session";
const secret = () => {
  const v = process.env.AUTH_SECRET || "";
  // a guessable secret would let anyone forge an admin login, so production refuses to run without a real one
  if (process.env.NODE_ENV === "production" && (v.length < 32 || v.startsWith("change-me"))) throw new Error("AUTH_SECRET must be a long random value (32+ characters)");
  return new TextEncoder().encode(v || "dev-only-insecure-secret-change-me");
};

export async function createSession(userId: number, remember = true) {
  const u = await db.query.users.findFirst({ columns: { sessionVersion: true }, where: eq(s.users.id, userId) });
  const token = await new SignJWT({ uid: userId, sv: u?.sessionVersion ?? 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(remember ? "30d" : "1d").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = await db.query.users.findFirst({ where: eq(s.users.id, Number(payload.uid)) });
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
