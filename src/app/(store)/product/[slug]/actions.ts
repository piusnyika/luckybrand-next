"use server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { boughtProduct } from "@/lib/reviews";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export type ReviewState = { ok?: string; error?: string } | undefined;

export async function submitReview(_: ReviewState, fd: FormData): Promise<ReviewState> {
  if (String(fd.get("website") || "")) return { ok: "Thanks! Your review will appear once we've checked it." }; // bots fill the hidden field
  if (!(await rateLimit("review:" + clientIp(await headers()), 5, 60 * 60))) return { error: "Too many reviews from your connection. Please try again later." };
  const user = await getCurrentUser();
  const productId = Number(fd.get("productId"));
  const rating = Number(fd.get("rating"));
  const name = String(fd.get("name") || user?.displayName || user?.firstName || "").trim().slice(0, 120);
  const email = (user?.email || String(fd.get("email") || "")).trim().toLowerCase();
  const title = String(fd.get("title") || "").trim().slice(0, 191);
  const body = String(fd.get("body") || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Please choose a star rating." };
  if (!name) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address (it isn't shown)." };
  if (body.length < 10) return { error: "Please write a few words about the product." };
  if (body.length > 3000) return { error: "Please keep the review under 3000 characters." };
  const product = await prisma.product.findFirst({ where: { id: productId, status: "published" }, select: { id: true } });
  if (!product) return { error: "This product is no longer available." };
  if (await prisma.review.findFirst({ where: { productId, email, status: { not: "rejected" } }, select: { id: true } }))
    return { error: "You've already reviewed this product. Thank you!" };
  await prisma.review.create({ data: { productId, userId: user?.id ?? null, name, email, rating, title, body, verified: await boughtProduct(productId, user?.id ?? null, email) } });
  return { ok: "Thanks! Your review will appear once we've checked it." };
}
