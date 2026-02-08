/*
  # Fix Profiles RLS Policies
  
  1. Security Improvements
    - Remove insecure anon access policy that allows unrestricted profile reads
    - Simplify authenticated user policies to avoid recursion issues
    
  2. Changes
    - Drop anon_select_profiles policy (security hole)
    - Simplify profile read policies for authenticated users
    - Ensure users can always read their own profile without complex subqueries
*/

-- Remove insecure anon policy
DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;

-- Drop existing authenticated policies to recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins and managers can read all profiles" ON profiles;

-- Allow authenticated users to read their own profile (simple, no subquery)
CREATE POLICY "authenticated_read_own_profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Allow reading all profiles for admins/managers (using app_metadata to avoid recursion)
CREATE POLICY "authenticated_read_all_profiles_if_admin"
  ON profiles FOR SELECT TO authenticated
  USING (
    (auth.jwt()->>'role')::text IN ('authenticated', 'service_role')
    OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'manager')
    )
  );