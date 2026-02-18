/*
  # Add is_active column to categories table

  1. Modified Tables
    - `categories`
      - Added `is_active` (boolean, default true) - allows categories to be deactivated without deletion

  2. Notes
    - All existing categories are set to active by default
    - The bulk-classify-tickets edge function filters by is_active = true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
