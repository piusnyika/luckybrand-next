"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password";
import { sendMail, layout } from "@/lib/mail";
import { getSite } from "@/lib/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { prisma, Prisma } from "@/lib/prisma";

export type FormState = { error?: string; ok?: string } | undefined;
const safeNext = (n: FormDataEntryValue | null) => { const v = String(n || ""); return v.startsWith("/") && !v.startsWith("//") ? v : "/my-account/"; };

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("username") || "").trim().toLowerCase();
  const pw = String(fd.get("password") || "");
  if (!(await rateLimit("login-ip:" + clientIp(await headers()), 30, 15 * 60)) || !(await rateLimit("login:" + id, 8, 15 * 60))) return { error: "Too many login attempts. Please wait 15 minutes and try again." };
  const u = await prisma.user.findFirst({ where: { OR: [{ email: { equals: id, mode: "insensitive" } }, { username: { equals: id, mode: "insensitive" } }] } });
  if (!u || !(await verifyPassword(pw, u.passwordHash))) return { error: "Unknown email address or incorrect password." };
  if (u.blocked) return { error: "This account has been disabled. Please contact us if you think this is a mistake." };
  if (needsRehash(u.passwordHash)) await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
  await createSession(u.id, fd.get("remember") === "on");
  redirect(safeNext(fd.get("next")));
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const pw = String(fd.get("password") || "");
  if (!(await rateLimit("register:" + clientIp(await headers()), 10, 60 * 60))) return { error: "Too many new accounts from your connection. Please try again later." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please provide a valid email address." };
  if (pw.length < 8) return { error: "Password must be at least 8 characters." };
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) return { error: "An account is already registered with your email address. Please log in." };
  const r = await prisma.user.create({ data: { email, username: email, passwordHash: await hashPassword(pw), displayName: email.split("@")[0], role: "customer" }, select: { id: true } });
  await createSession(r.id);
  redirect(safeNext(fd.get("next")));
}

export async function logout() { await destroySession(); redirect("/my-account/"); }

export async function saveAddress(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const g = (k: string) => String(fd.get(k) || "").trim();
  const billing = { firstName: g("firstName"), lastName: g("lastName"), company: g("company"), address1: g("address1"), address2: g("address2"), city: g("city"), state: g("state"), postcode: g("postcode"), country: "ZW", phone: g("phone"), email: g("email") || u.email };
  if (!billing.firstName || !billing.address1 || !billing.city) return { error: "Please fill in your name, street address and town/city." };
  await prisma.user.update({ where: { id: u.id }, data: { billing, phone: billing.phone } });
  revalidatePath("/my-account/edit-address/");
  return { ok: "Address changed successfully." };
}

export async function saveAccount(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const g = (k: string) => String(fd.get(k) || "").trim();
  const email = g("email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please provide a valid email address." };
  if (email !== u.email.toLowerCase() && (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: u.id } }, select: { id: true } }))) return { error: "This email address is already registered." };
  const patch: Prisma.UserUpdateInput = { firstName: g("firstName"), lastName: g("lastName"), displayName: g("displayName") || `${g("firstName")} ${g("lastName")}`.trim(), email };
  const cur = g("currentPassword"), next = g("newPassword");
  if (next) {
    // accounts created with Google have no password yet; let them set one
    if (u.passwordHash && !(await verifyPassword(cur, u.passwordHash))) return { error: "Your current password is incorrect." };
    if (next.length < 8) return { error: "New password must be at least 8 characters." };
    if (next !== g("confirmPassword")) return { error: "New passwords do not match." };
    patch.passwordHash = await hashPassword(next);
    patch.sessionVersion = u.sessionVersion + 1;
  }
  await prisma.user.update({ where: { id: u.id }, data: patch });
  if (next) await createSession(u.id); // stay signed in here; other devices are signed out
  return { ok: "Account details changed successfully." };
}

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("user_login") || "").trim().toLowerCase();
  if (!(await rateLimit("reset-ip:" + clientIp(await headers()), 10, 60 * 60)) || !(await rateLimit("reset:" + id, 3, 60 * 60))) return { ok: "If an account exists, a password reset email has been sent." };
  const u = await prisma.user.findFirst({ where: { OR: [{ email: { equals: id, mode: "insensitive" } }, { username: { equals: id, mode: "insensitive" } }] } });
  if (u && !u.blocked) {
    const token = randomBytes(24).toString("hex");
    await prisma.user.update({ where: { id: u.id }, data: { resetToken: token, resetExpires: new Date(Date.now() + 60 * 60 * 1000) } });
    const site = await getSite();
    const url = `${process.env.SITE_URL || ""}/my-account/reset-password/?token=${token}`;
    await sendMail(u.email, `Password reset request for ${site.name}`, await layout("Password reset request",
      `<p>Someone has requested a new password for your account on ${site.name}.</p><p>If you didn't make this request, just ignore this email.</p><p><a href="${url}" style="display:inline-block;background:#004798;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset your password</a></p><p style="font-size:12px;color:#737582">This link expires in 1 hour.</p>`));
  }
  return { ok: "If an account exists, a password reset email has been sent. Please check your inbox." };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") || ""); const pw = String(fd.get("password") || "");
  if (pw.length < 8) return { error: "Password must be at least 8 characters." };
  if (pw !== String(fd.get("confirm") || "")) return { error: "Passwords do not match." };
  const u = await prisma.user.findFirst({ where: { resetToken: token, resetExpires: { gt: new Date() } } });
  if (!u || u.blocked) return { error: "This password reset link is invalid or has expired." };
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw), resetToken: null, resetExpires: null, sessionVersion: u.sessionVersion + 1 } });
  await createSession(u.id);
  redirect("/my-account/");
}
