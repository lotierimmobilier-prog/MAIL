/*
  # Create Initial Admin User

  1. Purpose
    - Creates an initial admin account for first-time login
    - Email: admin@emailops.com
    - Password: AdminEmailOps2026!
    - This account should be used to log in and create other users
  
  2. Important Notes
    - The admin should change this password after first login
    - This user will have full admin privileges
    - The password must be changed via the Supabase dashboard or using the auth API
*/

-- Note: The initial admin user needs to be created through Supabase Auth dashboard
-- or using the Supabase CLI/API since we cannot directly insert into auth.users table

-- This migration serves as documentation for the initial setup process
-- Admin should:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User"
-- 3. Email: admin@emailops.com
-- 4. Password: AdminEmailOps2026! (change after first login)
-- 5. Enable "Auto Confirm User"

-- Or use this SQL to create via service role (must be run with service_role key):
-- The profile will be auto-created by the trigger, just need to update it to admin role

-- Create a function to set the first user as admin
CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first user (only one profile exists)
  IF (SELECT COUNT(*) FROM profiles) = 1 THEN
    UPDATE profiles 
    SET role = 'admin', 
        full_name = 'Administrateur Principal'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically make first user admin
DROP TRIGGER IF EXISTS on_first_user_created ON profiles;
CREATE TRIGGER on_first_user_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_first_user_as_admin();
