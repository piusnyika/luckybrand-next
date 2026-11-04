"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/guard";
import { checkCode, hashRecovery, newRecoveryCodes, newSecret } from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";
import { prisma, jsonOrNull } from "@/lib/prisma";

export type SecurityState = { error?: string; ok?: string; codes?: string[] } | undefined;
const PATH = "/admin/security/";

export async function startSetup() {
  const u = await requireStaff();
  await prisma.user.update({ where: { id: u.id }, data: { totpPending: newSecret() } });
  revalidatePath(PATH);
}

export async function cancelSetup() {
  const u = await requireStaff();
  await prisma.user.update({ where: { id: u.id }, data: { totpPending: null } });
  revalidatePath(PATH);
}

/** The first code from the app proves it was set up right; then two-step login is on */
export async function confirmSetup(_: SecurityState, fd: FormData): Promise<SecurityState> {
  const u = await requireStaff();
  if (!(await rateLimit("2fa-setup:" + u.id, 10, 10 * 60))) return { error: "Too many attempts. Wait a few minutes." };
  const me = await prisma.user.findUnique({ where: { id: u.id }, select: { totpPending: true } });
  if (!me?.totpPending) return { error: "Start the setup again." };
  const step = checkCode(me.totpPending, String(fd.get("code") || ""));
  if (step === null) return { error: "That code isn't right. Check you scanned the newest QR code and your phone's time is correct." };
  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({ where: { id: u.id }, data: { totpSecret: me.totpPending, totpPending: null, totpLastStep: step, totpRecovery: hashes } });
  // no revalidate here: the page would switch to its "on" view and hide the recovery codes before they're saved
  return { ok: "Two-step login is on. From now on you'll be asked for a code when you log in.", codes };
}

/** Turning it off or making new recovery codes needs a current code (or a recovery code) */
async function proveCode(userId: number, code: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpLastStep: true, totpRecovery: true } });
  if (!me?.totpSecret) return false;
  const step = checkCode(me.totpSecret, code, me.totpLastStep);
  if (step !== null) { await prisma.user.update({ where: { id: userId }, data: { totpLastStep: step } }); return true; }
  const hashes = (me.totpRecovery as string[] | null) ?? []; const h = hashRecovery(code);
  if (!hashes.includes(h)) return false;
  await prisma.user.update({ where: { id: userId }, data: { totpRecovery: hashes.filter((x) => x !== h) } });
  return true;
}

export async function disableTwoStep(_: SecurityState, fd: FormData): Promise<SecurityState> {
  const u = await requireStaff();
  if (!(await rateLimit("2fa-manage:" + u.id, 10, 10 * 60))) return { error: "Too many attempts. Wait a few minutes." };
  if (!(await proveCode(u.id, String(fd.get("code") || "")))) return { error: "That code isn't right." };
  await prisma.user.update({ where: { id: u.id }, data: { totpSecret: null, totpPending: null, totpLastStep: null, totpRecovery: jsonOrNull(null) } });
  revalidatePath(PATH);
  return { ok: "Two-step login is off." };
}

export async function regenerateCodes(_: SecurityState, fd: FormData): Promise<SecurityState> {
  const u = await requireStaff();
  if (!(await rateLimit("2fa-manage:" + u.id, 10, 10 * 60))) return { error: "Too many attempts. Wait a few minutes." };
  if (!(await proveCode(u.id, String(fd.get("code") || "")))) return { error: "That code isn't right." };
  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({ where: { id: u.id }, data: { totpRecovery: hashes } });
  revalidatePath(PATH);
  return { ok: "New recovery codes made. The old ones no longer work.", codes };
}
