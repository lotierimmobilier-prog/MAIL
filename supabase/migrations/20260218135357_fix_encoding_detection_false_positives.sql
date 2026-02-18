/*
  # Fix encoding detection false positives

  1. Changes
    - Rewrites `has_encoding_issues` to use exact mojibake string patterns instead of regex ranges
    - Prevents false positives on correctly encoded French text
  
  2. Notes
    - Previous regex pattern matched valid UTF-8 sequences like 'é' followed by certain chars
    - New approach checks for specific known mojibake sequences only
*/

CREATE OR REPLACE FUNCTION public.has_encoding_issues(text_input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF text_input IS NULL THEN RETURN false; END IF;
  RETURN text_input LIKE '%Ã©%'
    OR text_input LIKE '%Ã¨%'
    OR text_input LIKE '%Ãª%'
    OR text_input LIKE '%Ã§%'
    OR text_input LIKE '%Ã´%'
    OR text_input LIKE '%Ã®%'
    OR text_input LIKE '%Ã»%'
    OR text_input LIKE '%Ã¹%'
    OR text_input LIKE '%Ã¯%'
    OR text_input LIKE '%Ã«%'
    OR text_input LIKE '%Ã¢%'
    OR text_input LIKE '%â€™%'
    OR text_input LIKE '%â€œ%'
    OR text_input LIKE '%â€"%'
    OR text_input LIKE '%â‚¬%';
END;
$$;
