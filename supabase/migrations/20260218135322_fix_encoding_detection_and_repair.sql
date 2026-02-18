/*
  # Fix encoding detection and repair corrupted emails

  1. Changes
    - Rewrites `has_encoding_issues` function to detect mojibake at the character level
    - Runs encoding repair on all affected emails (body_text, body_html, subject)
    - Runs encoding repair on affected ticket subjects
  
  2. Affected Tables
    - `emails` - body_text, body_html, subject columns
    - `tickets` - subject column
  
  3. Notes
    - The previous detection used byte-level regex which doesn't work in PostgreSQL UTF-8 text
    - New detection uses actual mojibake character patterns (e.g. 'Ã©', 'Ã¨', etc.)
    - Only updates rows that contain mojibake patterns
*/

CREATE OR REPLACE FUNCTION public.has_encoding_issues(text_input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF text_input IS NULL THEN RETURN false; END IF;
  RETURN text_input ~ 'Ã[©¨ªëà¢¤¹»¼®¯´¶§±¿‰ˆŠ‹€‚„™›œ]'
    OR text_input ~ 'â€[™˜œ"—–¢¦]'
    OR text_input ~ 'Â[°«»·©®]'
    OR text_input ~ 'â‚¬';
END;
$$;

UPDATE emails
SET 
  body_text = CASE WHEN has_encoding_issues(body_text) THEN repair_utf8_encoding(body_text) ELSE body_text END,
  body_html = CASE WHEN has_encoding_issues(body_html) THEN repair_utf8_encoding(body_html) ELSE body_html END,
  subject = CASE WHEN has_encoding_issues(subject) THEN repair_utf8_encoding(subject) ELSE subject END
WHERE has_encoding_issues(body_text) 
   OR has_encoding_issues(body_html) 
   OR has_encoding_issues(subject);

UPDATE tickets
SET subject = repair_utf8_encoding(subject)
WHERE has_encoding_issues(subject);
