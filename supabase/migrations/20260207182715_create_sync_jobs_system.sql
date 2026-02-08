/*
  # Système de synchronisation par jobs

  1. Nouvelles tables
    - `sync_jobs`
      - `id` (uuid, primary key)
      - `mailbox_id` (uuid, référence mailboxes)
      - `status` (text: pending, processing, completed, failed)
      - `job_type` (text: full_sync, incremental_sync)
      - `batch_size` (integer: nombre d'emails à traiter)
      - `progress` (jsonb: détails de progression)
      - `error_message` (text: message d'erreur si échec)
      - `retry_count` (integer: nombre de tentatives)
      - `max_retries` (integer: nombre max de tentatives)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sync_state`
      - `id` (uuid, primary key)
      - `mailbox_id` (uuid, référence mailboxes, unique)
      - `last_synced_at` (timestamptz)
      - `last_sequence_number` (integer: dernier numéro de séquence traité)
      - `last_uid` (integer: dernier UID traité)
      - `total_emails_synced` (integer)
      - `last_error` (text)
      - `is_syncing` (boolean: lock pour éviter sync concurrent)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur toutes les tables
    - Policies restrictives pour sync_jobs et sync_state

  3. Index
    - Index sur mailbox_id et status pour sync_jobs
    - Index unique sur mailbox_id pour sync_state
*/

-- Table sync_jobs
CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  job_type text NOT NULL DEFAULT 'incremental_sync' CHECK (job_type IN ('full_sync', 'incremental_sync')),
  batch_size integer NOT NULL DEFAULT 20,
  progress jsonb DEFAULT '{"processed": 0, "total": 0, "synced": 0, "skipped": 0, "errors": 0}'::jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table sync_state
CREATE TABLE IF NOT EXISTS sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL UNIQUE REFERENCES mailboxes(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  last_sequence_number integer DEFAULT 0,
  last_uid integer DEFAULT 0,
  total_emails_synced integer DEFAULT 0,
  last_error text,
  is_syncing boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_sync_jobs_mailbox_status ON sync_jobs(mailbox_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_created ON sync_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_state_mailbox ON sync_state(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_syncing ON sync_state(is_syncing) WHERE is_syncing = true;

-- RLS pour sync_jobs
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all sync jobs"
  ON sync_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view sync jobs"
  ON sync_jobs FOR SELECT
  TO authenticated
  USING (true);

-- RLS pour sync_state
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all sync state"
  ON sync_state FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view sync state"
  ON sync_state FOR SELECT
  TO authenticated
  USING (true);

-- Fonction pour nettoyer les vieux jobs (> 7 jours)
CREATE OR REPLACE FUNCTION cleanup_old_sync_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM sync_jobs
  WHERE completed_at < now() - interval '7 days'
    AND status IN ('completed', 'failed');
END;
$$;

-- Fonction pour réinitialiser les jobs bloqués (> 15 minutes en processing)
CREATE OR REPLACE FUNCTION reset_stale_sync_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sync_jobs
  SET status = 'failed',
      error_message = 'Job timeout - processing took too long',
      completed_at = now()
  WHERE status = 'processing'
    AND started_at < now() - interval '15 minutes';

  UPDATE sync_state
  SET is_syncing = false
  WHERE is_syncing = true
    AND updated_at < now() - interval '15 minutes';
END;
$$;