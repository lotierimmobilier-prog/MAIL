-- Add Gmail OAuth token columns to mailboxes table
ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
  ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_history_id TEXT;

-- Store Gmail OAuth state for CSRF protection
CREATE TABLE IF NOT EXISTS gmail_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup expired states after 10 minutes
CREATE INDEX IF NOT EXISTS idx_gmail_oauth_states_created ON gmail_oauth_states(created_at);
