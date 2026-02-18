/*
  # Add allowed_views to profiles for granular permissions

  1. Modified Tables
    - `profiles`
      - Added `allowed_views` (text array, default all views) - controls which sections a user can access
        Possible values: dashboard, inbox, contacts, templates, knowledge, reports, admin

  2. Notes
    - Admins and managers always have full access regardless of this field
    - For agent/readonly roles, only listed views are accessible
    - Existing users get all views by default (no disruption)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'allowed_views'
  ) THEN
    ALTER TABLE profiles ADD COLUMN allowed_views text[] NOT NULL DEFAULT ARRAY['dashboard', 'inbox', 'contacts', 'templates', 'knowledge', 'reports', 'admin'];
  END IF;
END $$;
