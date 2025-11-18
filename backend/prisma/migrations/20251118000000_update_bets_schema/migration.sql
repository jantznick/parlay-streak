-- Update bets table to support new bet structure
-- Add new columns for structured bet configs
ALTER TABLE bets 
  ADD COLUMN IF NOT EXISTS display_text VARCHAR(255),
  ADD COLUMN IF NOT EXISTS display_text_override VARCHAR(255),
  ADD COLUMN IF NOT EXISTS config JSONB,
  ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS needs_admin_resolution BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS visible_from TIMESTAMP;

-- Migrate existing data: use description as display_text
UPDATE bets SET display_text = description WHERE display_text IS NULL;

-- Make display_text NOT NULL after migration
ALTER TABLE bets ALTER COLUMN display_text SET NOT NULL;

-- Update bet_type to support new types (keep old values for now)
-- New bet types: 'COMPARISON', 'THRESHOLD', 'EVENT'
-- Old bet types still supported: 'moneyline', 'spread', 'over_under', etc.

