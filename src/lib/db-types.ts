// Shapes of the JSON columns and the allowed values of string "enum" columns (see prisma/schema.prisma).

export type Address = {
  firstName?: string; lastName?: string; company?: string; address1?: string; address2?: string;
  city?: string; state?: string; postcode?: string; country?: string; email?: string; phone?: string;
};

export type ProductAttribute = { name: string; values: string[] };

/** What one unit of a bundle contained when it was ordered (so cancelling restocks the right items) */
export type BundleSnapshot = { productId: number; sku: string; name: string; qty: number }[];

export type UserRole = "admin" | "manager" | "customer";
export type ProductStatus = "published" | "draft" | "trash";
export type ProductType = "simple" | "bundle";
export type StockStatus = "instock" | "outofstock" | "onbackorder";
export type OrderStatus = "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed";
export type CouponType = "percent" | "fixed_cart" | "fixed_product";
export type ShippingType = "free" | "flat" | "pickup";
