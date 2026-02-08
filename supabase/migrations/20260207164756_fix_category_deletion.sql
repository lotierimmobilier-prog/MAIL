/*
  # Fix Category Deletion

  1. Changes
    - Modify foreign key constraints to allow category deletion
    - Set category_id to NULL in tickets when category is deleted
    - Set category_id to NULL in email_templates when category is deleted
    
  2. Details
    - Drop and recreate foreign key constraints with ON DELETE SET NULL
    - This allows categories to be deleted even when referenced
    - Related records will have their category_id set to NULL
*/

-- Fix tickets.category_id foreign key
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Fix email_templates.category_id foreign key
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_category_id_fkey;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
