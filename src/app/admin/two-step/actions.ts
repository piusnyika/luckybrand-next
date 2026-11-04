"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearPendingLogin, createSession, pendingLogin } from "@/lib/auth";
import { checkCode, hashRecovery } from "@/lib/totp";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export type TwoStepState = { error?: string } | undefined;

/** Second step of logging in: a code from the authenticator app, or one of the recovery codes */
export async function verifyTwoStep(_: TwoStepState, fd: FormData): Promise<TwoStepState> {
  const p = await pendingLogin();
  if (!p) redirect("/admin/login/?expired=1");
  if (!(await rateLimit("2fa:" + p.userId, 6, 10 * 60)) || !(await rateLimit("2fa-ip:" + clientIp(await headers()), 20, 10 * 60)))
    return { error: "Too many attempts. Wait 10 minutes and log in again." };
  const u = await prisma.user.findUnique({ where: { id: p.userId } });
  // password changed or account blocked since the password step
  if (!u || u.blocked || !u.totpSecret || u.sessionVersion !== p.sessionVersion) { await clearPendingLogin(); redirect("/admin/login/"); }
  const code = String(fd.get("code") || "").trim();
  const step = checkCode(u.totpSecret, code, u.totpLastStep);
  if (step !== null) {
    // only the first request using this step wins (a code can't be used twice, even at the same moment)
    const won = await prisma.user.updateMany({ where: { id: u.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
    if (!won.count) return { error: "That code was already used. Wait for the next one." };
  } else {
    const hashes = (u.totpRecovery as string[] | null) ?? [];
    const h = hashRecovery(code);
    if (!/[a-f0-9]{5}/i.test(code) || !hashes.includes(h)) return { error: "That code isn't right. Check the time on your phone is correct and try again." };
    await prisma.user.update({ where: { id: u.id }, data: { totpRecovery: hashes.filter((x) => x !== h) } });
  }
  await createSession(u.id, p.remember); // also clears the pending cookie
  redirect(p.next);
}
