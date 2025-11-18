-- Add last_insured_parlay_id to users table
ALTER TABLE "users" ADD COLUMN "last_insured_parlay_id" TEXT;

-- Drop parlay_bets table (no longer needed - using UserBetSelection with parlayId instead)
DROP TABLE IF EXISTS "parlay_bets";

