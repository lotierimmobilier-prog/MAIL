/*
  # Add keywords field to categories

  1. Changes
    - Add `keywords` column to `categories` table as text array
    - This will store keywords that help AI categorize emails automatically
    
  2. Notes
    - Keywords will be used by the classify-email function to improve categorization accuracy
    - Empty array by default for existing categories
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'keywords'
  ) THEN
    ALTER TABLE categories ADD COLUMN keywords text[] DEFAULT '{}';
  END IF;
END $$;

-- Update existing categories with example keywords
UPDATE categories SET keywords = ARRAY['visite', 'rendez-vous', 'visiter', 'voir'] WHERE name = 'Demande de visite';
UPDATE categories SET keywords = ARRAY['devis', 'estimation', 'prix', 'tarif', 'cout'] WHERE name = 'Demande de devis';
UPDATE categories SET keywords = ARRAY['reclamation', 'probleme', 'insatisfait', 'plainte'] WHERE name = 'Reclamation';
UPDATE categories SET keywords = ARRAY['resiliation', 'resilier', 'annuler', 'annulation'] WHERE name = 'Resiliation';
UPDATE categories SET keywords = ARRAY['information', 'renseignement', 'question'] WHERE name = 'Demande d''information';
