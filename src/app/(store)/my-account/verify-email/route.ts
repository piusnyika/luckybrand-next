import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The link from the "confirm your email address" email. It only confirms the address (it doesn't log in),
// because mail scanners often open links before the customer does.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const u = /^[a-f0-9]{48}$/.test(token) ? await prisma.user.findFirst({ where: { verifyToken: token }, select: { id: true } }) : null;
  if (u) await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date(), verifyToken: null } });
  return NextResponse.redirect(new URL(`/my-account/?verified=${u ? "1" : "invalid"}`, process.env.SITE_URL || req.url), 303);
}
