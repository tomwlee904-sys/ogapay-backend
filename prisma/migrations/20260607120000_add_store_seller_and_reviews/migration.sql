-- Add seller_id to store_items
ALTER TABLE "store_items" ADD COLUMN "seller_id" TEXT;

-- Create store_reviews table
CREATE TABLE "store_reviews" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "store_reviews_item_id_user_id_key" ON "store_reviews"("item_id", "user_id");

-- AddForeignKey
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_reviews" ADD CONSTRAINT "store_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_reviews" ADD CONSTRAINT "store_reviews_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "store_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
