/*
  # Fix email encoding for existing data

  1. Function
    - Create a function to detect and repair UTF-8 encoding issues
    - Specifically fixes cases where UTF-8 was decoded as ISO-8859-1
  
  2. Updates
    - Fix subject, body_text, and body_html fields in emails table
    - Only update rows with detected encoding issues
  
  3. Notes
    - Common corrupted patterns:
      - 'Ã©' should be 'é'
      - 'Ã ' should be 'à'
      - 'Ã¨' should be 'è'
      - 'Ã´' should be 'ô'
      - 'Ãª' should be 'ê'
      - 'Ã§' should be 'ç'
      - 'â' from apostrophe
*/

-- Create function to detect if text has encoding issues
CREATE OR REPLACE FUNCTION has_encoding_issues(text_input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF text_input IS NULL THEN
    RETURN false;
  END IF;
  
  -- Detect common UTF-8 misinterpretation patterns
  RETURN (
    text_input ~ 'Ã©|Ã |Ã¨|Ã´|Ãª|Ã§|Ã»|Ã®|Ã¯|Ã¹|Ã«|â|Ã'
  );
END;
$$;

-- Create function to repair UTF-8 encoding
CREATE OR REPLACE FUNCTION repair_utf8_encoding(text_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
BEGIN
  IF text_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Only process if there are encoding issues
  IF NOT has_encoding_issues(text_input) THEN
    RETURN text_input;
  END IF;
  
  result := text_input;
  
  -- Fix common UTF-8 characters misinterpreted as ISO-8859-1
  result := replace(result, 'Ã©', 'é');
  result := replace(result, 'Ã ', 'à');
  result := replace(result, 'Ã¨', 'è');
  result := replace(result, 'Ã´', 'ô');
  result := replace(result, 'Ãª', 'ê');
  result := replace(result, 'Ã§', 'ç');
  result := replace(result, 'Ã»', 'û');
  result := replace(result, 'Ã®', 'î');
  result := replace(result, 'Ã¯', 'ï');
  result := replace(result, 'Ã¹', 'ù');
  result := replace(result, 'Ã«', 'ë');
  result := replace(result, 'Ãº', 'ú');
  result := replace(result, 'Ã¢', 'â');
  result := replace(result, 'Ã®', 'î');
  result := replace(result, 'Ã´', 'ô');
  result := replace(result, 'Ã', 'À');
  result := replace(result, 'Ã‰', 'É');
  result := replace(result, 'Ãˆ', 'È');
  result := replace(result, 'ÃŠ', 'Ê');
  result := replace(result, 'Ã‡', 'Ç');
  
  -- Fix apostrophe issues
  result := replace(result, 'â€™', '''');
  result := replace(result, 'â€˜', '''');
  result := replace(result, 'â€œ', '"');
  result := replace(result, 'â€', '"');
  result := replace(result, 'â€"', '–');
  result := replace(result, 'â€"', '—');
  result := replace(result, 'â€¦', '…');
  
  -- Additional common issues
  result := replace(result, 'Ã', 'à');
  result := replace(result, 'Ã¢', 'â');
  
  RETURN result;
END;
$$;

-- Update emails with encoding issues
UPDATE emails
SET 
  subject = repair_utf8_encoding(subject),
  body_text = repair_utf8_encoding(body_text),
  body_html = repair_utf8_encoding(body_html)
WHERE 
  has_encoding_issues(subject) 
  OR has_encoding_issues(body_text) 
  OR has_encoding_issues(body_html);

-- Update tickets subject with encoding issues
UPDATE tickets
SET subject = repair_utf8_encoding(subject)
WHERE has_encoding_issues(subject);

-- Log the number of rows updated
DO $$
DECLARE
  email_count int;
  ticket_count int;
BEGIN
  SELECT COUNT(*) INTO email_count FROM emails 
  WHERE has_encoding_issues(subject) OR has_encoding_issues(body_text) OR has_encoding_issues(body_html);
  
  SELECT COUNT(*) INTO ticket_count FROM tickets 
  WHERE has_encoding_issues(subject);
  
  RAISE NOTICE 'Fixed % emails and % tickets with encoding issues', email_count, ticket_count;
END $$;
