/*
  # Add Due Dates, Notifications, and Knowledge Base Features

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text - mention, assignment, due_date, response_generated)
      - `title` (text)
      - `message` (text)
      - `link` (text - URL to relevant resource)
      - `is_read` (boolean)
      - `created_at` (timestamptz)
    
    - `knowledge_base_items`
      - `id` (uuid, primary key)
      - `title` (text)
      - `type` (text - pdf, url, document)
      - `category` (text)
      - `content` (text - extracted text content)
      - `file_url` (text - if PDF/file)
      - `source_url` (text - if web link)
      - `metadata` (jsonb - additional info)
      - `is_active` (boolean)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `ai_response_suggestions`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, references tickets)
      - `email_id` (uuid, references emails)
      - `suggested_response` (text)
      - `tone` (text - formal, friendly, neutral)
      - `confidence_score` (decimal)
      - `sources_used` (jsonb - array of knowledge base item IDs)
      - `status` (text - pending, accepted, rejected, modified)
      - `generated_at` (timestamptz)
      - `reviewed_at` (timestamptz)
      - `reviewed_by` (uuid, references profiles)

  2. Changes
    - Add `due_date` column to `tickets` table
    - Add `mentioned_users` jsonb column to `emails` for @mentions

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated user access
*/

-- Add due_date to tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE tickets ADD COLUMN due_date timestamptz;
  END IF;
END $$;

-- Add mentioned_users to emails for @mentions tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emails' AND column_name = 'mentioned_users'
  ) THEN
    ALTER TABLE emails ADD COLUMN mentioned_users jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Knowledge base items table
CREATE TABLE IF NOT EXISTS knowledge_base_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL DEFAULT '',
  file_url text,
  source_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_is_active ON knowledge_base_items(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_type ON knowledge_base_items(type);

-- AI response suggestions table
CREATE TABLE IF NOT EXISTS ai_response_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  suggested_response text NOT NULL,
  tone text NOT NULL DEFAULT 'neutral',
  confidence_score decimal(3,2) DEFAULT 0.80,
  sources_used jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_ticket_id ON ai_response_suggestions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_response_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_generated_at ON ai_response_suggestions(generated_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_suggestions ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Knowledge base policies
CREATE POLICY "Authenticated users can view active knowledge base items"
  ON knowledge_base_items FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create knowledge base items"
  ON knowledge_base_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own knowledge base items"
  ON knowledge_base_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own knowledge base items"
  ON knowledge_base_items FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- AI response suggestions policies
CREATE POLICY "Users can view suggestions for accessible tickets"
  ON ai_response_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ai_response_suggestions.ticket_id
    )
  );

CREATE POLICY "System can create suggestions"
  ON ai_response_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update suggestions"
  ON ai_response_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ai_response_suggestions.ticket_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ai_response_suggestions.ticket_id
    )
  );

CREATE POLICY "Users can delete suggestions"
  ON ai_response_suggestions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ai_response_suggestions.ticket_id
    )
  );
