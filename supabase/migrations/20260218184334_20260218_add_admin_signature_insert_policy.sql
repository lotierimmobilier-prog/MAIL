/*
  # Add admin INSERT policy for user_signatures

  Issue: Admins couldn't create signatures for other users due to RLS policy
  
  The existing INSERT policy only allowed users to insert signatures for themselves.
  Admins need a separate policy to create signatures for any user.
*/

CREATE POLICY "Admins can insert signatures for any user"
  ON user_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
