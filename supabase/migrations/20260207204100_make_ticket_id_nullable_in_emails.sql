/*
  # Make ticket_id nullable in emails table

  1. Changes
    - Remove NOT NULL constraint from `ticket_id` column in `emails` table
    - This allows sending emails that are not associated with a specific ticket
    
  2. Notes
    - Some emails may be sent independently without a ticket context
    - This provides flexibility for standalone email sending
*/

-- Make ticket_id nullable
ALTER TABLE emails ALTER COLUMN ticket_id DROP NOT NULL;
