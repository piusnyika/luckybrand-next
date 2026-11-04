import {
  mysqlTable, int, varchar, text, mediumtext, decimal, boolean, datetime, mysqlEnum,
  primaryKey, index, customType,
} from "drizzle-orm/mysql-core";

// JSON column that also works on MariaDB (where JSON is stored as LONGTEXT and comes back as a string)
const json = customType<{ data: any; driverData: string }>({
  dataType() { return "json"; },
  toDriver(v) { return JSON.stringify(v); },
  fromDriver(v) { return typeof v === "string" ? JSON.parse(v) : v; },
});
import { relations, sql } from "drizzle-orm";

const now = () => datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`);
const updated = () => datetime("updated_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date());
const money = (name: string) => decimal(name, { precision: 12, scale: 2 });

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  username: varchar("username", { length: 191 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 120 }).notNull().default(""),
  lastName: varchar("last_name", { length: 120 }).notNull().default(""),
  displayName: varchar("display_name", { length: 191 }).notNull().default(""),
  phone: varchar("phone", { length: 50 }).notNull().default(""),
  role: mysqlEnum("role", ["admin", "manager", "customer"]).notNull().default("customer"),
  /** raised when the password changes, which signs out every existing session */
  sessionVersion: int("session_version").notNull().default(0),
  /** blocked accounts can't log in; existing sessions stop working */
  blocked: boolean("blocked").notNull().default(false),
  billing: json("billing").$type<Address | null>(),
  shipping: json("shipping").$type<Address | null>(),
  resetToken: varchar("reset_token", { length: 100 }),
  resetExpires: datetime("reset_expires", { mode: "date" }),
  createdAt: now(),
  updatedAt: updated(),
});

export type Address = {
  firstName?: string; lastName?: string; company?: string; address1?: string; address2?: string;
  city?: string; state?: string; postcode?: string; country?: string; email?: string; phone?: string;
};

export const media = mysqlTable("media", {
  id: int("id").autoincrement().primaryKey(),
  url: varchar("url", { length: 512 }).notNull(),
  alt: varchar("alt", { length: 255 }).notNull().default(""),
  title: varchar("title", { length: 255 }).notNull().default(""),
  mime: varchar("mime", { length: 100 }).notNull().default("image/jpeg"),
  width: int("width"),
  height: int("height"),
  size: int("size"),
  createdAt: now(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  description: text("description"),
  image: varchar("image", { length: 512 }),
  parentId: int("parent_id"),
  sortOrder: int("sort_order").notNull().default(0),
  showInMenu: boolean("show_in_menu").notNull().default(true),
  seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
  seoDescription: text("seo_description"),
}, (t) => [index("cat_parent").on(t.parentId)]);

export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  description: text("description"),
  image: varchar("image", { length: 512 }),
});

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
});

export type ProductAttribute = { name: string; values: string[] };

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  sku: varchar("sku", { length: 100 }),
  status: mysqlEnum("status", ["published", "draft", "trash"]).notNull().default("published"),
  /** bundle: made of other products (product_bundle_items); its stock comes from them */
  type: mysqlEnum("type", ["simple", "bundle"]).notNull().default("simple"),
  /** set while status is "trash"; restored to statusBeforeTrash, emptied automatically after 30 days */
  trashedAt: datetime("trashed_at", { mode: "date" }),
  statusBeforeTrash: mysqlEnum("status_before_trash", ["published", "draft"]),
  shortDescription: text("short_description"),
  description: mediumtext("description"),
  specification: mediumtext("specification"),
  regularPrice: money("regular_price").notNull().default("0"),
  salePrice: money("sale_price"),
  saleFrom: datetime("sale_from", { mode: "date" }),
  saleTo: datetime("sale_to", { mode: "date" }),
  stockStatus: mysqlEnum("stock_status", ["instock", "outofstock", "onbackorder"]).notNull().default("instock"),
  manageStock: boolean("manage_stock").notNull().default(false),
  stockQty: int("stock_qty"),
  lowStockAmount: int("low_stock_amount"),
  weight: varchar("weight", { length: 50 }).notNull().default(""),
  featured: boolean("featured").notNull().default(false),
  badgeText: varchar("badge_text", { length: 100 }).notNull().default(""),
  videoUrl: varchar("video_url", { length: 512 }).notNull().default(""),
  attributes: json("attributes").$type<ProductAttribute[]>(),
  seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
  seoDescription: text("seo_description"),
  focusKeyword: varchar("focus_keyword", { length: 191 }).notNull().default(""),
  primaryCategoryId: int("primary_category_id"),
  imageId: int("image_id"),
  totalSales: int("total_sales").notNull().default(0),
  views: int("views").notNull().default(0),
  createdAt: now(),
  updatedAt: updated(),
}, (t) => [
  index("prod_status_created").on(t.status, t.createdAt),
  index("prod_featured").on(t.featured),
  index("prod_sku").on(t.sku),
]);

export const productCategories = mysqlTable("product_categories", {
  productId: int("product_id").notNull(),
  categoryId: int("category_id").notNull(),
}, (t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index("pc_cat").on(t.categoryId)]);

export const productBrands = mysqlTable("product_brands", {
  productId: int("product_id").notNull(),
  brandId: int("brand_id").notNull(),
}, (t) => [primaryKey({ columns: [t.productId, t.brandId] }), index("pb_brand").on(t.brandId)]);

export const productTags = mysqlTable("product_tags", {
  productId: int("product_id").notNull(),
  tagId: int("tag_id").notNull(),
}, (t) => [primaryKey({ columns: [t.productId, t.tagId] }), index("pt_tag").on(t.tagId)]);

export const productImages = mysqlTable("product_images", {
  productId: int("product_id").notNull(),
  mediaId: int("media_id").notNull(),
  position: int("position").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.productId, t.mediaId] })]);

/** Items in a bundle product: `qty` of product `productId` per one bundle */
export const productBundleItems = mysqlTable("product_bundle_items", {
  bundleId: int("bundle_id").notNull(),
  productId: int("product_id").notNull(),
  qty: int("qty").notNull().default(1),
  position: int("position").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.bundleId, t.productId] }), index("pbi_product").on(t.productId)]);

/** What one unit of a bundle contained when it was ordered (so cancelling restocks the right items) */
export type BundleSnapshot = { productId: number; sku: string; name: string; qty: number }[];

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 50 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]).notNull().default("pending"),
  userId: int("user_id"),
  email: varchar("email", { length: 191 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull().default(""),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  subtotal: money("subtotal").notNull().default("0"),
  discountTotal: money("discount_total").notNull().default("0"),
  shippingTotal: money("shipping_total").notNull().default("0"),
  taxTotal: money("tax_total").notNull().default("0"),
  total: money("total").notNull().default("0"),
  couponCode: varchar("coupon_code", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 100 }).notNull().default(""),
  paymentMethodTitle: varchar("payment_method_title", { length: 191 }).notNull().default(""),
  transactionId: varchar("transaction_id", { length: 191 }).notNull().default(""),
  paynowPollUrl: varchar("paynow_poll_url", { length: 512 }),
  paynowReference: varchar("paynow_reference", { length: 191 }),
  billing: json("billing").$type<Address>().notNull(),
  shipping: json("shipping").$type<Address | null>(),
  shippingMethod: varchar("shipping_method", { length: 191 }).notNull().default(""),
  customerNote: text("customer_note"),
  ipAddress: varchar("ip_address", { length: 64 }).notNull().default(""),
  accessKey: varchar("access_key", { length: 64 }).notNull().unique(),
  paidAt: datetime("paid_at", { mode: "date" }),
  completedAt: datetime("completed_at", { mode: "date" }),
  createdAt: now(),
  updatedAt: updated(),
}, (t) => [index("ord_status_created").on(t.status, t.createdAt), index("ord_email").on(t.email), index("ord_user").on(t.userId)]);

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id"),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().default(""),
  quantity: int("quantity").notNull(),
  unitPrice: money("unit_price").notNull(),
  total: money("total").notNull(),
  bundle: json("bundle").$type<BundleSnapshot | null>(),
}, (t) => [index("oi_order").on(t.orderId)]);

export const orderNotes = mysqlTable("order_notes", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  content: text("content").notNull(),
  isCustomer: boolean("is_customer").notNull().default(false),
  author: varchar("author", { length: 191 }).notNull().default("system"),
  createdAt: now(),
}, (t) => [index("on_order").on(t.orderId)]);

export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  description: varchar("description", { length: 255 }).notNull().default(""),
  type: mysqlEnum("type", ["percent", "fixed_cart", "fixed_product"]).notNull().default("percent"),
  amount: money("amount").notNull(),
  minSpend: money("min_spend"),
  maxSpend: money("max_spend"),
  freeShipping: boolean("free_shipping").notNull().default(false),
  usageLimit: int("usage_limit"),
  usageCount: int("usage_count").notNull().default(0),
  expiresAt: datetime("expires_at", { mode: "date" }),
  active: boolean("active").notNull().default(true),
  createdAt: now(),
});

export const shippingMethods = mysqlTable("shipping_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  type: mysqlEnum("type", ["free", "flat", "pickup"]).notNull(),
  cost: money("cost").notNull().default("0"),
  minAmount: money("min_amount"),
  note: varchar("note", { length: 255 }).notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
});

export const pages = mysqlTable("pages", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  content: mediumtext("content").notNull(),
  published: boolean("published").notNull().default(true),
  seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
  seoDescription: text("seo_description"),
  updatedAt: updated(),
});

export const menuItems = mysqlTable("menu_items", {
  id: int("id").autoincrement().primaryKey(),
  menu: varchar("menu", { length: 50 }).notNull(),
  label: varchar("label", { length: 191 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  parentId: int("parent_id"),
  position: int("position").notNull().default(0),
}, (t) => [index("menu_pos").on(t.menu, t.position)]);

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: json("value").notNull(),
});

export const redirects = mysqlTable("redirects", {
  id: int("id").autoincrement().primaryKey(),
  from: varchar("from_path", { length: 191 }).notNull().unique(),
  to: varchar("to_path", { length: 512 }).notNull(),
  code: int("code").notNull().default(301),
  hits: int("hits").notNull().default(0),
  createdAt: now(),
});

export const subscribers = mysqlTable("subscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  createdAt: now(),
});

export const contactMessages = mysqlTable("contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull().default(""),
  subject: varchar("subject", { length: 255 }).notNull().default(""),
  message: text("message").notNull(),
  read: boolean("is_read").notNull().default(false),
  createdAt: now(),
});

export const productsRelations = relations(products, ({ many, one }) => ({
  categories: many(productCategories),
  brands: many(productBrands),
  tags: many(productTags),
  images: many(productImages),
  primaryCategory: one(categories, { fields: [products.primaryCategoryId], references: [categories.id] }),
  image: one(media, { fields: [products.imageId], references: [media.id] }),
}));
export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, { fields: [productCategories.productId], references: [products.id] }),
  category: one(categories, { fields: [productCategories.categoryId], references: [categories.id] }),
}));
export const productBrandsRelations = relations(productBrands, ({ one }) => ({
  product: one(products, { fields: [productBrands.productId], references: [products.id] }),
  brand: one(brands, { fields: [productBrands.brandId], references: [brands.id] }),
}));
export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, { fields: [productTags.productId], references: [products.id] }),
  tag: one(tags, { fields: [productTags.tagId], references: [tags.id] }),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
  media: one(media, { fields: [productImages.mediaId], references: [media.id] }),
}));
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "tree" }),
  children: many(categories, { relationName: "tree" }),
  products: many(productCategories),
}));
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  notes: many(orderNotes),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
  order: one(orders, { fields: [orderNotes.orderId], references: [orders.id] }),
}));
export const usersRelations = relations(users, ({ many }) => ({ orders: many(orders) }));
