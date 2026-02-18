/*
  # Fix profiles update RLS policy

  1. Changes
    - Drop existing "Update profiles" policy that is missing WITH CHECK clause
    - Recreate with both USING and WITH CHECK so admins can update other users' profiles
    - Users can update their own profile (non-role fields)
    - Admins can update any profile

  2. Security
    - Maintains same access pattern: own profile or admin
    - Adds WITH CHECK to allow the update to complete
*/

DROP POLICY IF EXISTS "Update profiles" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
