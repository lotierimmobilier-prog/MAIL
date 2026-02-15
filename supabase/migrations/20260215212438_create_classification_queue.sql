/*
  # Création de la queue de classification asynchrone

  1. Nouvelle table
    - `classification_queue`
      - `id` (uuid, primary key)
      - `email_id` (uuid, référence emails)
      - `ticket_id` (uuid, référence tickets)
      - `status` (text: pending, processing, completed, failed)
      - `priority` (integer: priorité de traitement, 1=haute, 5=basse)
      - `retry_count` (integer: nombre de tentatives)
      - `max_retries` (integer: nombre max de tentatives)
      - `error_message` (text: message d'erreur si échec)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur classification_queue
    - Policies restrictives pour service role et authenticated

  3. Index
    - Index sur status et priority pour traitement efficace de la queue
    - Index sur email_id pour éviter les doublons
*/

CREATE TABLE IF NOT EXISTS classification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_queue_status_priority 
  ON classification_queue(status, priority, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_classification_queue_email 
  ON classification_queue(email_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_classification_queue_email_pending
  ON classification_queue(email_id)
  WHERE status IN ('pending', 'processing');

ALTER TABLE classification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all classification queue"
  ON classification_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view classification queue"
  ON classification_queue FOR SELECT
  TO authenticated
  USING (true);