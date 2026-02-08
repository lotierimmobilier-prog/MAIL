/*
  # Simplify Profiles Read Access
  
  1. Changes
    - Allow all authenticated users to read all profiles
    - This prevents recursion issues during login
    - Acceptable for internal team collaboration tool
    - Write operations remain restricted to admins/self
    
  2. Security Notes
    - Read access to profiles is generally safe for team tools
    - Sensitive data should not be stored in profiles table
    - Update/Delete operations remain properly restricted
*/

-- Drop the complex recursive policy
DROP POLICY IF EXISTS "authenticated_read_all_profiles_if_admin" ON profiles;

-- Simple policy: all authenticated users can read all profiles
CREATE POLICY "authenticated_users_read_all_profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);