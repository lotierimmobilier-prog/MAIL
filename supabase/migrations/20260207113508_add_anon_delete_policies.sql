/*
  # Add delete policies for anon role

  1. Security Changes
    - Add anon DELETE policies on tickets, emails, ai_classifications,
      internal_notes, and attachments to support bulk delete from inbox

  2. Important Notes
    - Required for the batch delete feature in the inbox view
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_tickets') THEN
    CREATE POLICY "anon_delete_tickets" ON tickets FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_emails') THEN
    CREATE POLICY "anon_delete_emails" ON emails FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_ai_classifications') THEN
    CREATE POLICY "anon_delete_ai_classifications" ON ai_classifications FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_internal_notes') THEN
    CREATE POLICY "anon_delete_internal_notes" ON internal_notes FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_attachments') THEN
    CREATE POLICY "anon_delete_attachments" ON attachments FOR DELETE TO anon USING (true);
  END IF;
END $$;
