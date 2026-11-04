"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export async function saveCoupon(fd: FormData) {
  await requireStaff();
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null;
  const code = g("code").toLowerCase().replace(/\s+/g, "");
  if (!code) redirect("/admin/coupons/?msg=Error%3A%20code%20required");
  if (await prisma.coupon.findFirst({ where: id ? { code, id: { not: id } } : { code }, select: { id: true } })) redirect("/admin/coupons/?msg=Error%3A%20that%20code%20already%20exists");
  const n = (k: string) => (g(k) === "" ? null : String(Number(g(k))));
  const data = {
    code, description: g("description"), type: g("type") as "percent" | "fixed_cart" | "fixed_product", amount: n("amount") ?? "0",
    minSpend: n("minSpend"), maxSpend: n("maxSpend"), freeShipping: fd.get("freeShipping") === "on",
    usageLimit: g("usageLimit") ? Number(g("usageLimit")) : null, expiresAt: g("expiresAt") ? new Date(g("expiresAt") + "T23:59:59") : null, active: fd.get("active") === "on",
  };
  if (id) await prisma.coupon.update({ where: { id }, data }); else await prisma.coupon.create({ data });
  redirect(`/admin/coupons/?msg=${encodeURIComponent("Coupon saved")}`);
}
export async function deleteCoupon(fd: FormData) { await requireStaff(); await prisma.coupon.deleteMany({ where: { id: Number(fd.get("id")) } }); redirect("/admin/coupons/?msg=Coupon%20deleted"); }
