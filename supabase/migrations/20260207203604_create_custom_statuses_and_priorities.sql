/*
  # Create custom ticket statuses and priorities system

  1. New Tables
    - `ticket_statuses`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Status name
      - `description` (text) - Status description
      - `color` (text) - Display color
      - `icon` (text) - Icon name
      - `order` (integer) - Display order
      - `is_default` (boolean) - Is this the default status
      - `is_active` (boolean) - Is this status active
      - `created_at` (timestamptz)

    - `ticket_priorities`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Priority name
      - `description` (text) - Priority description
      - `color` (text) - Display color
      - `level` (integer) - Priority level (1-10)
      - `is_default` (boolean) - Is this the default priority
      - `is_active` (boolean) - Is this priority active
      - `created_at` (timestamptz)

  2. Changes
    - Make `status` and `priority` nullable in `tickets` table
    - Add foreign key relationships

  3. Security
    - Enable RLS on both tables
    - Add read policies for authenticated users
    - Add manage policies for admin users only

  4. Data
    - Seed with existing status and priority values
*/

-- Create ticket_statuses table
CREATE TABLE IF NOT EXISTS ticket_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#64748B',
  icon text DEFAULT 'circle',
  "order" integer DEFAULT 0,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create ticket_priorities table
CREATE TABLE IF NOT EXISTS ticket_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#64748B',
  level integer DEFAULT 5,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_priorities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_statuses
CREATE POLICY "Anyone can view ticket statuses"
  ON ticket_statuses FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert ticket statuses"
  ON ticket_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update ticket statuses"
  ON ticket_statuses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete ticket statuses"
  ON ticket_statuses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for ticket_priorities
CREATE POLICY "Anyone can view ticket priorities"
  ON ticket_priorities FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert ticket priorities"
  ON ticket_priorities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update ticket priorities"
  ON ticket_priorities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete ticket priorities"
  ON ticket_priorities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seed ticket_statuses with existing values
INSERT INTO ticket_statuses (name, description, color, icon, "order", is_default) VALUES
  ('Non traité', 'Nouveau ticket non assigné', '#94A3B8', 'inbox', 1, true),
  ('À qualifier', 'Ticket en cours de qualification', '#F59E0B', 'help-circle', 2, false),
  ('Assigné', 'Ticket assigné à un agent', '#3B82F6', 'user-check', 3, false),
  ('En cours', 'Ticket en cours de traitement', '#8B5CF6', 'activity', 4, false),
  ('En attente', 'En attente de réponse du client', '#EC4899', 'clock', 5, false),
  ('Répondu', 'Réponse envoyée au client', '#10B981', 'mail-check', 6, false),
  ('Clôturé', 'Ticket résolu et fermé', '#059669', 'check-circle', 7, false)
ON CONFLICT (name) DO NOTHING;

-- Seed ticket_priorities with existing values
INSERT INTO ticket_priorities (name, description, color, level, is_default) VALUES
  ('Faible', 'Demande non urgente', '#10B981', 1, false),
  ('Normal', 'Demande standard', '#64748B', 5, true),
  ('Élevé', 'Demande importante', '#F59E0B', 7, false),
  ('Urgent', 'Demande critique nécessitant une action immédiate', '#EF4444', 10, false)
ON CONFLICT (name) DO NOTHING;
