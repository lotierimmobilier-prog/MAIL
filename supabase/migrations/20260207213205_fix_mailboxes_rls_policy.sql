/*
  # Fix mailboxes RLS policy

  ## Problem
  The "Permitted users read mailboxes" policy has a bug where it compares:
  `mp.mailbox_id = mp.id` instead of `mp.mailbox_id = mailboxes.id`
  
  This prevents authenticated users from seeing mailboxes even with proper permissions.

  ## Changes
  1. Drop the incorrect policy
  2. Recreate it with the correct join condition
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Permitted users read mailboxes" ON mailboxes;

-- Create the correct policy
CREATE POLICY "Permitted users read mailboxes"
  ON mailboxes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM mailbox_permissions mp 
      WHERE mp.mailbox_id = mailboxes.id 
      AND mp.user_id = auth.uid()
    ) 
    OR 
    EXISTS (
      SELECT 1 
      FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );