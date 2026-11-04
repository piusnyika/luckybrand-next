import "server-only";
import { prisma } from "@/lib/prisma";

/** Order statuses that count as "bought it" for the Verified purchase badge */
export const BOUGHT = ["processing", "completed", "on-hold"];

/** Approved reviews of a product with the average and how many of each star rating */
export async function productReviews(productId: number) {
  const reviews = await prisma.review.findMany({ where: { productId, status: "approved" }, orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, name: true, rating: true, title: true, body: true, verified: true, createdAt: true } });
  const dist = [0, 0, 0, 0, 0];
  for (const r of reviews) dist[r.rating - 1]++;
  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10 : 0;
  return { reviews, count, avg, dist };
}
export type ProductReviews = Awaited<ReturnType<typeof productReviews>>;

/** Did this account or email buy the product (paid order)? */
export async function boughtProduct(productId: number, userId: number | null, email: string) {
  const n = await prisma.orderItem.count({ where: { productId, order: { status: { in: BOUGHT }, OR: [...(userId ? [{ userId }] : []), { email: { equals: email, mode: "insensitive" } }] } } });
  return n > 0;
}
