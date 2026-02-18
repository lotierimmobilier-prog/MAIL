/*
  # Create shared contacts directory

  1. New Tables
    - `contacts`
      - `id` (uuid, primary key)
      - `email` (text, unique, not null) - primary email address
      - `first_name` (text) - first name
      - `last_name` (text) - last name
      - `company` (text) - company/organization name
      - `phone` (text) - phone number
      - `notes` (text) - free-form notes
      - `source` (text) - how the contact was created: 'manual', 'csv_import', 'auto_sync', 'ai_extracted'
      - `last_contacted_at` (timestamptz) - last time an email was sent/received
      - `email_count` (integer) - total emails exchanged
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `contacts` table
    - Authenticated users can read all contacts (shared directory)
    - Authenticated users can insert/update contacts
    - Only admin/manager can delete contacts

  3. Indexes
    - Index on email for fast lookups
    - Index on last_name, first_name for sorting
    - Full-text search index on email, first_name, last_name, company
*/

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  last_contacted_at timestamptz,
  email_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_email_unique UNIQUE (email)
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts
  USING gin (to_tsvector('french', coalesce(email, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company, '')));
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts (source);
