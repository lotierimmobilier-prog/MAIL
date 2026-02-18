/*
  # Fix user_signatures INSERT policy

  Issue: INSERT policy on user_signatures is missing USING clause, causing RLS violation
  
  The INSERT policy "Users can insert own signatures" only had WITH CHECK but no USING clause.
  For INSERT operations, the table is empty, so USING is not checked. However, the policy
  structure should be corrected for consistency.
  
  Solution: Drop and recreate the INSERT policy with proper format
*/

DROP POLICY IF EXISTS "Users can insert own signatures" ON user_signatures;

CREATE POLICY "Users can insert own signatures"
  ON user_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
