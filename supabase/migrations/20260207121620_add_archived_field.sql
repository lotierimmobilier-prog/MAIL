/*
  # Add archived field to tickets

  1. Changes
    - Add `archived` boolean column to `tickets` table with default value of false
    - Add `archived_at` timestamp column to track when ticket was archived
    - Add index on archived field for better query performance
  
  2. Notes
    - Archived tickets will be hidden from the default inbox view
    - Tickets older than 30 days will be automatically archived
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'archived'
  ) THEN
    ALTER TABLE tickets ADD COLUMN archived boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_archived ON tickets(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
