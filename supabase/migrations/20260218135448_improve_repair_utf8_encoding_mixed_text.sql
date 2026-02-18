/*
  # Improve repair_utf8_encoding for mixed-encoding text

  1. Changes
    - Rewrites `repair_utf8_encoding` to use character-level replacements
    - Handles mixed text where some parts are correct UTF-8 and some are mojibake
    - Previous version used convert_from/convert_to which fails on mixed content
  
  2. Notes
    - This approach is safer for production data as it only replaces known mojibake patterns
    - Covers all common French accented characters and punctuation
*/

CREATE OR REPLACE FUNCTION public.repair_utf8_encoding(text_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  IF text_input IS NULL THEN RETURN NULL; END IF;
  
  result := text_input;
  
  result := replace(result, 'Ã©', 'é');
  result := replace(result, 'Ã¨', 'è');
  result := replace(result, 'Ãª', 'ê');
  result := replace(result, 'Ã«', 'ë');
  result := replace(result, 'Ã ', 'à');
  result := replace(result, 'Ã¢', 'â');
  result := replace(result, 'Ã¤', 'ä');
  result := replace(result, 'Ã¹', 'ù');
  result := replace(result, 'Ã»', 'û');
  result := replace(result, 'Ã¼', 'ü');
  result := replace(result, 'Ã®', 'î');
  result := replace(result, 'Ã¯', 'ï');
  result := replace(result, 'Ã´', 'ô');
  result := replace(result, 'Ã¶', 'ö');
  result := replace(result, 'Ã§', 'ç');
  result := replace(result, 'Ã±', 'ñ');
  result := replace(result, 'Ã¿', 'ÿ');
  result := replace(result, 'Ãœ', 'Ü');
  result := replace(result, E'\u00C3\u0089', 'É');
  result := replace(result, E'\u00C3\u0088', 'È');
  result := replace(result, E'\u00C3\u008A', 'Ê');
  result := replace(result, E'\u00C3\u008B', 'Ë');
  result := replace(result, E'\u00C3\u0080', 'À');
  result := replace(result, E'\u00C3\u0082', 'Â');
  result := replace(result, E'\u00C3\u0084', 'Ä');
  result := replace(result, E'\u00C3\u0099', 'Ù');
  result := replace(result, E'\u00C3\u009B', 'Û');
  result := replace(result, E'\u00C3\u008E', 'Î');
  result := replace(result, E'\u00C3\u008F', 'Ï');
  result := replace(result, E'\u00C3\u0094', 'Ô');
  result := replace(result, E'\u00C3\u0096', 'Ö');
  result := replace(result, E'\u00C3\u0087', 'Ç');
  result := replace(result, E'\u00C3\u0091', 'Ñ');
  result := replace(result, E'\u00C3\u009F', 'ß');
  
  result := replace(result, 'â€™', E'\u2019');
  result := replace(result, 'â€˜', E'\u2018');
  result := replace(result, 'â€œ', E'\u201C');
  result := replace(result, E'â€\u009D', E'\u201D');
  result := replace(result, 'â€"', E'\u2014');
  result := replace(result, 'â€"', E'\u2013');
  result := replace(result, 'â€¢', E'\u2022');
  result := replace(result, 'â€¦', E'\u2026');
  result := replace(result, 'â‚¬', E'\u20AC');
  
  result := replace(result, 'Â°', '°');
  result := replace(result, 'Â«', '«');
  result := replace(result, 'Â»', '»');
  result := replace(result, 'Â·', '·');
  result := replace(result, 'Â©', '©');
  result := replace(result, 'Â®', '®');
  result := replace(result, E'Â\u00A0', E'\u00A0');
  
  result := replace(result, 'Å"', 'œ');
  result := replace(result, E'Å\u0092', 'Œ');
  
  RETURN result;
END;
$$;
