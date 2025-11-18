/*
  Warnings:

  - Made the column `needs_admin_resolution` on table `bets` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "bets" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "bet_value" DROP NOT NULL,
ALTER COLUMN "last_fetched_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "needs_admin_resolution" SET NOT NULL,
ALTER COLUMN "visible_from" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bets_visible_from_idx" ON "bets"("visible_from");
