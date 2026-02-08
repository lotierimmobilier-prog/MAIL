/*
  # Add OVH Configuration to Mailboxes

  1. Changes
    - Add `provider_type` column to distinguish between IMAP and OVH providers
    - Add `ovh_consumer_key` column to store the OVH consumer key for authenticated API calls
    - Add `ovh_domain` column to store the email domain configured in OVH
    - Add `ovh_account` column to store the email account name (local part)
  
  2. Notes
    - Default provider_type is 'imap' for backward compatibility
    - OVH fields are nullable and only used when provider_type is 'ovh'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mailboxes' AND column_name = 'provider_type'
  ) THEN
    ALTER TABLE mailboxes ADD COLUMN provider_type text DEFAULT 'imap' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mailboxes' AND column_name = 'ovh_consumer_key'
  ) THEN
    ALTER TABLE mailboxes ADD COLUMN ovh_consumer_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mailboxes' AND column_name = 'ovh_domain'
  ) THEN
    ALTER TABLE mailboxes ADD COLUMN ovh_domain text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mailboxes' AND column_name = 'ovh_account'
  ) THEN
    ALTER TABLE mailboxes ADD COLUMN ovh_account text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mailboxes_provider_type ON mailboxes(provider_type);
