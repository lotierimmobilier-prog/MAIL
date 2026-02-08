/*
  # Add System Settings Table

  1. New Table
    - `system_settings` - Global application settings
      - `key` (text, primary key) - Setting identifier
      - `value` (jsonb) - Setting value
      - `description` (text) - Setting description
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated
    
  2. Security
    - Enable RLS
    - Authenticated users can read settings
    - Only admins can modify settings
    
  3. Initial Data
    - Set default mailbox sync interval to 600 seconds (10 minutes)
*/

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read settings"
  ON system_settings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admins update settings"
  ON system_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Admins insert settings"
  ON system_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('mailbox_sync_interval_seconds', '600', 'Intervalle de synchronisation automatique des boîtes mail (en secondes)')
ON CONFLICT (key) DO NOTHING;

-- Add index for faster updates
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at DESC);
