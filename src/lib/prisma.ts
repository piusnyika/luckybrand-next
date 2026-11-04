import { Prisma, PrismaClient } from "@prisma/client";
import type { Address, BundleSnapshot, CouponType, OrderStatus, ProductAttribute, ProductStatus, ProductType, ShippingType, StockStatus, UserRole } from "./db-types";

const g = globalThis as unknown as { __prisma?: PrismaClient };
const base = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = base;

// Results are shaped the way the app expects them:
// - money columns come back as strings like "12.50" (Prisma's Decimal objects can't be passed to client components)
// - JSON columns are typed (Address, ProductAttribute[], BundleSnapshot) instead of JsonValue
// - string "enum" columns are typed as their unions
type D = Prisma.Decimal;
const money = (v: D) => v.toFixed(2);
const moneyOrNull = (v: D | null) => (v == null ? null : v.toFixed(2));

export const prisma = base.$extends({
  result: {
    product: {
      regularPrice: { needs: { regularPrice: true }, compute: (r) => money(r.regularPrice) },
      salePrice: { needs: { salePrice: true }, compute: (r) => moneyOrNull(r.salePrice) },
      attributes: { needs: { attributes: true }, compute: (r) => r.attributes as ProductAttribute[] | null },
      status: { needs: { status: true }, compute: (r) => r.status as ProductStatus },
      type: { needs: { type: true }, compute: (r) => r.type as ProductType },
      stockStatus: { needs: { stockStatus: true }, compute: (r) => r.stockStatus as StockStatus },
      statusBeforeTrash: { needs: { statusBeforeTrash: true }, compute: (r) => r.statusBeforeTrash as "published" | "draft" | null },
    },
    order: {
      subtotal: { needs: { subtotal: true }, compute: (r) => money(r.subtotal) },
      discountTotal: { needs: { discountTotal: true }, compute: (r) => money(r.discountTotal) },
      shippingTotal: { needs: { shippingTotal: true }, compute: (r) => money(r.shippingTotal) },
      taxTotal: { needs: { taxTotal: true }, compute: (r) => money(r.taxTotal) },
      total: { needs: { total: true }, compute: (r) => money(r.total) },
      billing: { needs: { billing: true }, compute: (r) => r.billing as Address },
      shipping: { needs: { shipping: true }, compute: (r) => r.shipping as Address | null },
      status: { needs: { status: true }, compute: (r) => r.status as OrderStatus },
    },
    orderItem: {
      unitPrice: { needs: { unitPrice: true }, compute: (r) => money(r.unitPrice) },
      total: { needs: { total: true }, compute: (r) => money(r.total) },
      bundle: { needs: { bundle: true }, compute: (r) => r.bundle as BundleSnapshot | null },
    },
    coupon: {
      amount: { needs: { amount: true }, compute: (r) => money(r.amount) },
      minSpend: { needs: { minSpend: true }, compute: (r) => moneyOrNull(r.minSpend) },
      maxSpend: { needs: { maxSpend: true }, compute: (r) => moneyOrNull(r.maxSpend) },
      type: { needs: { type: true }, compute: (r) => r.type as CouponType },
    },
    shippingMethod: {
      cost: { needs: { cost: true }, compute: (r) => money(r.cost) },
      minAmount: { needs: { minAmount: true }, compute: (r) => moneyOrNull(r.minAmount) },
      type: { needs: { type: true }, compute: (r) => r.type as ShippingType },
    },
    user: {
      billing: { needs: { billing: true }, compute: (r) => r.billing as Address | null },
      shipping: { needs: { shipping: true }, compute: (r) => r.shipping as Address | null },
      role: { needs: { role: true }, compute: (r) => r.role as UserRole },
    },
  },
});

/** The client, or the `tx` handed to a prisma.$transaction callback */
export type Db = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/** For writing a nullable JSON column: Prisma needs Prisma.DbNull instead of a plain null */
export const jsonOrNull = <T>(v: T | null | undefined) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

export { Prisma };
export default prisma;
