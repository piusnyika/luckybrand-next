-- CreateTable
CREATE TABLE "search_terms" (
    "id" SERIAL NOT NULL,
    "term" VARCHAR(100) NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 1,
    "last_results" INTEGER NOT NULL DEFAULT 0,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_terms_term_key" ON "search_terms"("term");

-- CreateIndex
CREATE INDEX "search_terms_results" ON "search_terms"("last_results", "searches");

-- CreateIndex
CREATE INDEX "search_terms_last" ON "search_terms"("last_at");
