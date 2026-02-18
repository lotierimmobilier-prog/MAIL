/*
  # Fix admin profile update RLS using helper function

  1. Changes
    - Create a security definer function to check admin role without recursion
    - Replace the admin update policy to use the function instead of subquery
    - This avoids RLS recursion when updating profiles table

  2. Security
    - Function is SECURITY DEFINER to bypass RLS when checking admin status
    - Only checks if current auth.uid() has admin role
    - Search path set to public for security
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

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
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Profile auto-creation on signup" ON profiles;
CREATE POLICY "Profile auto-creation on signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = id) OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
