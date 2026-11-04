import { NextRequest, NextResponse } from "next/server";
import { db, schema as s } from "@/db";
import { addToMailchimp } from "@/lib/mailchimp";
import { clientIp, rateLimit } from "@/lib/rate-limit";
export async function POST(req: NextRequest) {
  if (!(await rateLimit("newsletter:" + clientIp(req.headers), 10, 3600))) return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  await db.insert(s.subscribers).values({ email: e }).onDuplicateKeyUpdate({ set: { email: e } });
  await addToMailchimp(e).catch(() => {});
  return NextResponse.json({ message: "Thanks for subscribing!" });
}
