"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export async function moderateReview(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id")); const to = String(fd.get("to")); const back = String(fd.get("back") || "/admin/reviews/");
  if (to === "delete") await prisma.review.deleteMany({ where: { id } });
  else if (to === "approved" || to === "rejected" || to === "pending") await prisma.review.update({ where: { id }, data: { status: to } });
  refreshStore();
  redirect(`${back.startsWith("/admin/reviews/") ? back : "/admin/reviews/"}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(to === "delete" ? "Review deleted" : `Review ${to}`)}`);
}
