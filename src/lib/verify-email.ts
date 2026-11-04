import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail, layout } from "@/lib/mail";
import { getSite } from "@/lib/settings";

/** Sends (or re-sends) the "confirm your email address" link. The account can log in once it's clicked. */
export async function sendVerificationEmail(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, verifyToken: true, firstName: true } });
  if (!u || u.emailVerifiedAt) return;
  const token = u.verifyToken || randomBytes(24).toString("hex");
  if (!u.verifyToken) await prisma.user.update({ where: { id: userId }, data: { verifyToken: token } });
  const site = await getSite();
  const url = `${process.env.SITE_URL || ""}/my-account/verify-email/?token=${token}`;
  await sendMail(u.email, `Confirm your email address for ${site.name}`, await layout("Confirm your email address",
    `<p>Hi${u.firstName ? " " + u.firstName.replace(/[<>&"]/g, "") : ""},</p><p>Thanks for creating an account with ${site.name}. Please confirm this is your email address to activate it.</p>
     <p><a href="${url}" style="display:inline-block;background:#004798;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirm my email</a></p>
     <p style="font-size:12px;color:#737582">If you didn't create an account, you can ignore this email.</p>`));
}
