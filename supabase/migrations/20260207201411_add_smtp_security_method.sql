/*
  # Add SMTP Security Method Selection

  1. Changes
    - Add `smtp_security` column to `mailboxes` table
    - Options: 'SSL', 'TLS', 'STARTTLS', 'None'
    - Default to 'SSL' for existing mailboxes
  
  2. Purpose
    - Allow users to choose encryption method for SMTP connections
    - Support different email provider requirements
    - Improve compatibility with various mail servers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mailboxes' AND column_name = 'smtp_security'
  ) THEN
    ALTER TABLE mailboxes 
    ADD COLUMN smtp_security text NOT NULL DEFAULT 'SSL'
    CHECK (smtp_security IN ('SSL', 'TLS', 'STARTTLS', 'None'));
  END IF;
END $$;