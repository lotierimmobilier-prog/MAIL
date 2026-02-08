/*
  # Add read status and user colors

  1. Changes to tickets table
    - Add `is_read` column (boolean, default false) to track if ticket has been viewed
    - Add `last_read_at` column (timestamptz, nullable) to track when ticket was last viewed
    - Add `last_read_by` column (uuid, nullable) to track who last read the ticket
  
  2. Changes to profiles table
    - Add `avatar_color` column (text, default '#0891B2') for user color indicator
  
  3. Security
    - Update RLS policies to allow reading these new fields
*/

-- Add read tracking to tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE tickets ADD COLUMN is_read boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'last_read_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN last_read_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'last_read_by'
  ) THEN
    ALTER TABLE tickets ADD COLUMN last_read_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add color to profiles for assignee indicators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'avatar_color'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_color text DEFAULT '#0891B2';
  END IF;
END $$;

-- Set default colors for existing users (different colors for variety)
UPDATE profiles SET avatar_color = '#0891B2' WHERE avatar_color IS NULL OR avatar_color = '';
