/*
  # Add User Email Signatures

  ## New Tables
    - `user_signatures`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key to profiles) - Owner of the signature
      - `name` (text) - Signature name/label
      - `html_content` (text) - HTML signature content
      - `is_default` (boolean) - Whether this is the default signature
      - `is_active` (boolean) - Whether signature is active
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  ## Security
    - Enable RLS on `user_signatures` table
    - Policies for users to manage their own signatures
    - Admins can manage all signatures

  ## Notes
    - Each user can have multiple signatures
    - Only one signature can be default per user
    - HTML content is sanitized on frontend before saving
*/

-- Create user_signatures table
CREATE TABLE IF NOT EXISTS user_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Ma signature',
  html_content text NOT NULL DEFAULT '',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_signatures_user_id ON user_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signatures_default ON user_signatures(user_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE user_signatures ENABLE ROW LEVEL SECURITY;

-- Users can view their own signatures
CREATE POLICY "Users can view own signatures"
  ON user_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all signatures
CREATE POLICY "Admins can view all signatures"
  ON user_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can insert their own signatures
CREATE POLICY "Users can insert own signatures"
  ON user_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own signatures
CREATE POLICY "Users can update own signatures"
  ON user_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update all signatures
CREATE POLICY "Admins can update all signatures"
  ON user_signatures FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can delete their own signatures
CREATE POLICY "Users can delete own signatures"
  ON user_signatures FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can delete all signatures
CREATE POLICY "Admins can delete all signatures"
  ON user_signatures FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to ensure only one default signature per user
CREATE OR REPLACE FUNCTION ensure_single_default_signature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE user_signatures
    SET is_default = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to maintain single default signature
CREATE TRIGGER trg_ensure_single_default_signature
  BEFORE INSERT OR UPDATE ON user_signatures
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_signature();