/*
  # Make ticket status and priority nullable

  1. Changes
    - Remove NOT NULL constraint and default values from `status` column in `tickets`
    - Remove NOT NULL constraint and default values from `priority` column in `tickets`
    - Remove CHECK constraints on status and priority
    
  2. Notes
    - New tickets will have NULL status and priority by default
    - Status and priority will be set manually or by AI classification
*/

-- Drop existing constraints
ALTER TABLE tickets ALTER COLUMN status DROP DEFAULT;
ALTER TABLE tickets ALTER COLUMN status DROP NOT NULL;
ALTER TABLE tickets ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE tickets ALTER COLUMN priority DROP NOT NULL;

-- Remove old check constraints if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tickets' AND constraint_name = 'tickets_status_check'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_status_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tickets' AND constraint_name = 'tickets_priority_check'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_priority_check;
  END IF;
END $$;
