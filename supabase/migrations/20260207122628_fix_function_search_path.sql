/*
  # Fix Function Search Path Security

  1. Security Changes
    - Set immutable search_path for SECURITY DEFINER function
    - This prevents potential security vulnerabilities where malicious users
      could manipulate the search path to execute unauthorized code
    
  2. Changes
    - Add SET search_path = public, auth to handle_new_user function
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  );
  RETURN NEW;
END;
$$;
