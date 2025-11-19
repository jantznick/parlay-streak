-- AlterTable: Add email verification fields to users table
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_verification_token" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN "email_verification_expires" TIMESTAMP(3);

-- CreateIndex: Add unique index on email_verification_token
CREATE UNIQUE INDEX "users_email_verification_token_key" ON "users"("email_verification_token");

-- Update existing users: Set email_verified to true for all existing users
-- This ensures existing users (like the admin) don't get locked out
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;

