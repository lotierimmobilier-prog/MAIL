/*
  # Add HTML Signatures and Inline Attachment Support

  ## Table Modifications
    - `mailboxes` - Add `signature_html` column for rich HTML signatures
    - `attachments` - Add `is_inline` and `content_id` for inline images

  ## Changes
    1. Adds `signature_html` to mailboxes table
    2. Adds `is_inline` boolean flag to attachments
    3. Adds `content_id` for inline image references in HTML emails
    4. Creates index for content_id lookups
*/

-- Add HTML signature column to mailboxes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mailboxes' AND column_name = 'signature_html'
  ) THEN
    ALTER TABLE mailboxes ADD COLUMN signature_html text DEFAULT '';
  END IF;
END $$;

-- Add inline attachment support columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'is_inline'
  ) THEN
    ALTER TABLE attachments ADD COLUMN is_inline boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'content_id'
  ) THEN
    ALTER TABLE attachments ADD COLUMN content_id text;
  END IF;
END $$;

-- Create index for faster content_id lookups
CREATE INDEX IF NOT EXISTS idx_attachments_content_id ON attachments(content_id) WHERE content_id IS NOT NULL;