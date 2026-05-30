-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('WORKER', 'POSTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WalletCurrency" AS ENUM ('NGN', 'USDC', 'USDT', 'ETH', 'MATIC');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TASK_PAYMENT', 'TASK_REFUND', 'PLATFORM_FEE', 'REFERRAL_BONUS', 'STORE_PURCHASE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('SOCIAL_MEDIA', 'DATA_ENTRY', 'CONTENT_WRITING', 'APP_TESTING', 'SURVEY', 'DESIGN', 'TRANSLATION', 'WEB_RESEARCH', 'VIDEO_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaskSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "WorkerLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'LEGEND');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'CRYPTO', 'INTERNAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabase_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "phone" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'WORKER',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "referral_code" TEXT NOT NULL,
    "referred_by_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_ref" TEXT,
    "id_type" TEXT,
    "id_number" TEXT,
    "id_front_url" TEXT,
    "id_back_url" TEXT,
    "selfie_url" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'NG',
    "rejection_reason" TEXT,
    "verified_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "currency" "WalletCurrency" NOT NULL,
    "balance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "locked_balance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "wallet_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "currency" "WalletCurrency" NOT NULL,
    "reference" TEXT NOT NULL,
    "external_ref" TEXT,
    "provider" "PaymentProvider",
    "metadata" JSONB,
    "description" TEXT,
    "balance_before" DECIMAL(20,8) NOT NULL,
    "balance_after" DECIMAL(20,8) NOT NULL,
    "task_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" "WorkerLevel" NOT NULL DEFAULT 'BEGINNER',
    "reputation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_earned" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_rejected" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "bio" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poster_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT,
    "website" TEXT,
    "total_posted" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poster_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "poster_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
    "reward" DECIMAL(20,8) NOT NULL,
    "currency" "WalletCurrency" NOT NULL DEFAULT 'NGN',
    "max_workers" INTEGER NOT NULL DEFAULT 1,
    "current_workers" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "instructions" TEXT,
    "proof_required" TEXT,
    "tags" TEXT[],
    "attachments" JSONB,
    "escrowed" BOOLEAN NOT NULL DEFAULT false,
    "escrow_tx_id" TEXT,
    "platform_fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "is_remote" BOOLEAN NOT NULL DEFAULT true,
    "estimated_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_submissions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "status" "TaskSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "proof" TEXT,
    "attachments" JSONB,
    "worker_notes" TEXT,
    "poster_notes" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "paid_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "poster_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "worker_evidence" TEXT,
    "poster_evidence" TEXT,
    "resolution" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "outcome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "currency" "WalletCurrency" NOT NULL DEFAULT 'NGN',
    "image_url" TEXT,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price" DECIMAL(20,8) NOT NULL,
    "currency" "WalletCurrency" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_user_id_key" ON "kyc_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_currency_key" ON "wallets"("user_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_reference_idx" ON "transactions"("reference");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "worker_profiles_user_id_key" ON "worker_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "poster_profiles_user_id_key" ON "poster_profiles"("user_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_category_idx" ON "tasks"("category");

-- CreateIndex
CREATE INDEX "tasks_poster_id_idx" ON "tasks"("poster_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_task_id_worker_id_key" ON "task_submissions"("task_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_submission_id_key" ON "disputes"("submission_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poster_profiles" ADD CONSTRAINT "poster_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "task_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_purchases" ADD CONSTRAINT "store_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_purchases" ADD CONSTRAINT "store_purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "store_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

