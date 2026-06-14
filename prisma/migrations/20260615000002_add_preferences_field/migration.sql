-- AlterTable: add preferences JSON column
ALTER TABLE "users" ADD COLUMN "preferences" JSONB DEFAULT '{}';
