/*
  # Add Anonymous Access Policies

  1. Security Changes
    - Add anon SELECT/INSERT/UPDATE/DELETE policies on all tables
    - This enables the app to work with password-gate authentication
      instead of Supabase auth
    - The frontend password gate (LOTIER2026) provides access control
    - Make author_id nullable on internal_notes for anon inserts

  2. Important Notes
    - This is an internal tool behind a password gate
    - RLS remains enabled but allows anon access
    - All existing authenticated policies remain in place
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_notes' AND column_name = 'author_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE internal_notes ALTER COLUMN author_id DROP NOT NULL;
  END IF;
END $$;

CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_subcategories" ON subcategories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_subcategories" ON subcategories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_subcategories" ON subcategories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_subcategories" ON subcategories FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_tags" ON tags FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_tags" ON tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tags" ON tags FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_tags" ON tags FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_mailboxes" ON mailboxes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_mailboxes" ON mailboxes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_mailboxes" ON mailboxes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_mailboxes" ON mailboxes FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_mailbox_permissions" ON mailbox_permissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_mailbox_permissions" ON mailbox_permissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_mailbox_permissions" ON mailbox_permissions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_mailbox_permissions" ON mailbox_permissions FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_tickets" ON tickets FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_tickets" ON tickets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tickets" ON tickets FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_ticket_tags" ON ticket_tags FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_ticket_tags" ON ticket_tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_ticket_tags" ON ticket_tags FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_emails" ON emails FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_emails" ON emails FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_attachments" ON attachments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_attachments" ON attachments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_ai_classifications" ON ai_classifications FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_ai_classifications" ON ai_classifications FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_email_templates" ON email_templates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_email_templates" ON email_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_email_templates" ON email_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_email_templates" ON email_templates FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_template_tags" ON template_tags FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_template_tags" ON template_tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_template_tags" ON template_tags FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_template_versions" ON template_versions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_template_versions" ON template_versions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_internal_notes" ON internal_notes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_internal_notes" ON internal_notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_internal_notes" ON internal_notes FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_audit_log" ON audit_log FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_audit_log" ON audit_log FOR INSERT TO anon WITH CHECK (true);
