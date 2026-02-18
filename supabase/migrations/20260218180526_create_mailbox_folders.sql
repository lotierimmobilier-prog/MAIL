/*
  # Create mailbox folders system

  1. New Tables
    - `mailbox_folders`
      - `id` (uuid, primary key)
      - `mailbox_id` (uuid, references mailboxes)
      - `name` (text) - folder display name
      - `imap_path` (text) - IMAP folder path (e.g., INBOX, Sent, Drafts)
      - `parent_id` (uuid, nullable, self-reference for nested folders)
      - `sort_order` (int) - display ordering
      - `created_at` (timestamptz)

  2. Modified Tables
    - `emails` - add `folder_id` column referencing mailbox_folders

  3. Security
    - Enable RLS on `mailbox_folders`
    - Policies for authenticated users to CRUD based on mailbox permissions
*/

CREATE TABLE IF NOT EXISTS mailbox_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  name text NOT NULL,
  imap_path text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES mailbox_folders(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mailbox_id, name, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_mailbox_folders_mailbox ON mailbox_folders(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_folders_parent ON mailbox_folders(parent_id);

ALTER TABLE mailbox_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read folders for accessible mailboxes"
  ON mailbox_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mailbox_permissions mp
      WHERE mp.mailbox_id = mailbox_folders.mailbox_id
      AND mp.user_id = auth.uid()
      AND mp.can_read = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can insert folders"
  ON mailbox_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions mp
      WHERE mp.mailbox_id = mailbox_folders.mailbox_id
      AND mp.user_id = auth.uid()
      AND mp.can_manage = true
    )
  );

CREATE POLICY "Admins and managers can update folders"
  ON mailbox_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions mp
      WHERE mp.mailbox_id = mailbox_folders.mailbox_id
      AND mp.user_id = auth.uid()
      AND mp.can_manage = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions mp
      WHERE mp.mailbox_id = mailbox_folders.mailbox_id
      AND mp.user_id = auth.uid()
      AND mp.can_manage = true
    )
  );

CREATE POLICY "Admins and managers can delete folders"
  ON mailbox_folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions mp
      WHERE mp.mailbox_id = mailbox_folders.mailbox_id
      AND mp.user_id = auth.uid()
      AND mp.can_manage = true
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emails' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE emails ADD COLUMN folder_id uuid REFERENCES mailbox_folders(id) ON DELETE SET NULL;
    CREATE INDEX idx_emails_folder ON emails(folder_id);
  END IF;
END $$;

INSERT INTO mailbox_folders (mailbox_id, name, imap_path, sort_order)
SELECT id, 'Boite de reception', 'INBOX', 0 FROM mailboxes WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO mailbox_folders (mailbox_id, name, imap_path, sort_order)
SELECT id, 'Envoyes', 'Sent', 1 FROM mailboxes WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO mailbox_folders (mailbox_id, name, imap_path, sort_order)
SELECT id, 'Brouillons', 'Drafts', 2 FROM mailboxes WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO mailbox_folders (mailbox_id, name, imap_path, sort_order)
SELECT id, 'Corbeille', 'Trash', 3 FROM mailboxes WHERE is_active = true
ON CONFLICT DO NOTHING;
