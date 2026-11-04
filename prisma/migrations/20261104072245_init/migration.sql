-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "username" VARCHAR(191),
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(120) NOT NULL DEFAULT '',
    "last_name" VARCHAR(120) NOT NULL DEFAULT '',
    "display_name" VARCHAR(191) NOT NULL DEFAULT '',
    "phone" VARCHAR(50) NOT NULL DEFAULT '',
    "role" VARCHAR(20) NOT NULL DEFAULT 'customer',
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "billing" JSONB,
    "shipping" JSONB,
    "reset_token" VARCHAR(100),
    "reset_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "alt" VARCHAR(255) NOT NULL DEFAULT '',
    "title" VARCHAR(255) NOT NULL DEFAULT '',
    "mime" VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "description" TEXT,
    "image" VARCHAR(512),
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "show_in_menu" BOOLEAN NOT NULL DEFAULT true,
    "seo_title" VARCHAR(255) NOT NULL DEFAULT '',
    "seo_description" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "description" TEXT,
    "image" VARCHAR(512),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "sku" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "type" VARCHAR(20) NOT NULL DEFAULT 'simple',
    "trashed_at" TIMESTAMP(3),
    "status_before_trash" VARCHAR(20),
    "short_description" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "regular_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(12,2),
    "sale_from" TIMESTAMP(3),
    "sale_to" TIMESTAMP(3),
    "stock_status" VARCHAR(20) NOT NULL DEFAULT 'instock',
    "manage_stock" BOOLEAN NOT NULL DEFAULT false,
    "stock_qty" INTEGER,
    "low_stock_amount" INTEGER,
    "weight" VARCHAR(50) NOT NULL DEFAULT '',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "badge_text" VARCHAR(100) NOT NULL DEFAULT '',
    "video_url" VARCHAR(512) NOT NULL DEFAULT '',
    "attributes" JSONB,
    "seo_title" VARCHAR(255) NOT NULL DEFAULT '',
    "seo_description" TEXT,
    "focus_keyword" VARCHAR(191) NOT NULL DEFAULT '',
    "primary_category_id" INTEGER,
    "image_id" INTEGER,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "product_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id","category_id")
);

-- CreateTable
CREATE TABLE "product_brands" (
    "product_id" INTEGER NOT NULL,
    "brand_id" INTEGER NOT NULL,

    CONSTRAINT "product_brands_pkey" PRIMARY KEY ("product_id","brand_id")
);

-- CreateTable
CREATE TABLE "product_tags" (
    "product_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("product_id","tag_id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "product_id" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_id","media_id")
);

-- CreateTable
CREATE TABLE "product_bundle_items" (
    "bundle_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_bundle_items_pkey" PRIMARY KEY ("bundle_id","product_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "number" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "user_id" INTEGER,
    "email" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(50) NOT NULL DEFAULT '',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coupon_code" VARCHAR(100),
    "payment_method" VARCHAR(100) NOT NULL DEFAULT '',
    "payment_method_title" VARCHAR(191) NOT NULL DEFAULT '',
    "transaction_id" VARCHAR(191) NOT NULL DEFAULT '',
    "paynow_poll_url" VARCHAR(512),
    "paynow_reference" VARCHAR(191),
    "billing" JSONB NOT NULL,
    "shipping" JSONB,
    "shipping_method" VARCHAR(191) NOT NULL DEFAULT '',
    "customer_note" TEXT,
    "ip_address" VARCHAR(64) NOT NULL DEFAULT '',
    "access_key" VARCHAR(64) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(100) NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "bundle" JSONB,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "author" VARCHAR(191) NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL DEFAULT '',
    "type" VARCHAR(20) NOT NULL DEFAULT 'percent',
    "amount" DECIMAL(12,2) NOT NULL,
    "min_spend" DECIMAL(12,2),
    "max_spend" DECIMAL(12,2),
    "free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "min_amount" DECIMAL(12,2),
    "note" VARCHAR(255) NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "seo_title" VARCHAR(255) NOT NULL DEFAULT '',
    "seo_description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "menu" VARCHAR(50) NOT NULL,
    "label" VARCHAR(191) NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "parent_id" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" SERIAL NOT NULL,
    "from_path" VARCHAR(191) NOT NULL,
    "to_path" VARCHAR(512) NOT NULL,
    "code" INTEGER NOT NULL DEFAULT 301,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(50) NOT NULL DEFAULT '',
    "subject" VARCHAR(255) NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "cat_parent" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "prod_status_created" ON "products"("status", "created_at");

-- CreateIndex
CREATE INDEX "prod_featured" ON "products"("featured");

-- CreateIndex
CREATE INDEX "prod_sku" ON "products"("sku");

-- CreateIndex
CREATE INDEX "pc_cat" ON "product_categories"("category_id");

-- CreateIndex
CREATE INDEX "pb_brand" ON "product_brands"("brand_id");

-- CreateIndex
CREATE INDEX "pt_tag" ON "product_tags"("tag_id");

-- CreateIndex
CREATE INDEX "pbi_product" ON "product_bundle_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_access_key_key" ON "orders"("access_key");

-- CreateIndex
CREATE INDEX "ord_status_created" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "ord_email" ON "orders"("email");

-- CreateIndex
CREATE INDEX "ord_user" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "oi_order" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "on_order" ON "order_notes"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "menu_pos" ON "menu_items"("menu", "position");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects"("from_path");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_primary_category_id_fkey" FOREIGN KEY ("primary_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
