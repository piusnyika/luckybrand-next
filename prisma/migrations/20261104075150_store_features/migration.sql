-- AlterTable
ALTER TABLE "products" ADD COLUMN     "low_stock_notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "totp_last_step" INTEGER,
ADD COLUMN     "totp_pending" VARCHAR(64),
ADD COLUMN     "totp_recovery" JSONB,
ADD COLUMN     "totp_secret" VARCHAR(64),
ADD COLUMN     "verify_token" VARCHAR(100);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(191) NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_carts" (
    "user_id" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminded_at" TIMESTAMP(3),

    CONSTRAINT "saved_carts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(50) NOT NULL DEFAULT '',
    "company" VARCHAR(191) NOT NULL DEFAULT '',
    "city" VARCHAR(120) NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "staff_note" TEXT NOT NULL DEFAULT '',
    "order_id" INTEGER,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rev_product" ON "reviews"("product_id", "status");

-- CreateIndex
CREATE INDEX "rev_status" ON "reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "cart_updated" ON "saved_carts"("updated_at");

-- CreateIndex
CREATE INDEX "alert_open" ON "stock_alerts"("notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "alert_product_email" ON "stock_alerts"("product_id", "email");

-- CreateIndex
CREATE INDEX "quote_status" ON "quote_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_carts" ADD CONSTRAINT "saved_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Accounts that existed before email verification count as verified
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
