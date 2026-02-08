/*
  # Remove Insecure Anon RLS Policies

  1. Security Changes
    - Drop all anon role policies that allow unrestricted access (USING true)
    - These policies effectively bypass row-level security
    - Edge functions should use service role key for data operations
    
  2. Policies Removed
    - All anon_* policies across all tables
    - These policies allowed unrestricted read/write access for anonymous users
*/

DROP POLICY IF EXISTS "anon_delete_ai_classifications" ON ai_classifications;
DROP POLICY IF EXISTS "anon_insert_ai_classifications" ON ai_classifications;
DROP POLICY IF EXISTS "anon_delete_attachments" ON attachments;
DROP POLICY IF EXISTS "anon_insert_attachments" ON attachments;
DROP POLICY IF EXISTS "anon_insert_audit_log" ON audit_log;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
DROP POLICY IF EXISTS "anon_delete_email_templates" ON email_templates;
DROP POLICY IF EXISTS "anon_insert_email_templates" ON email_templates;
DROP POLICY IF EXISTS "anon_update_email_templates" ON email_templates;
DROP POLICY IF EXISTS "anon_delete_emails" ON emails;
DROP POLICY IF EXISTS "anon_insert_emails" ON emails;
DROP POLICY IF EXISTS "anon_delete_internal_notes" ON internal_notes;
DROP POLICY IF EXISTS "anon_insert_internal_notes" ON internal_notes;
DROP POLICY IF EXISTS "anon_update_internal_notes" ON internal_notes;
DROP POLICY IF EXISTS "anon_delete_mailbox_permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "anon_insert_mailbox_permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "anon_update_mailbox_permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "anon_delete_mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "anon_insert_mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "anon_update_mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "anon_delete_subcategories" ON subcategories;
DROP POLICY IF EXISTS "anon_insert_subcategories" ON subcategories;
DROP POLICY IF EXISTS "anon_update_subcategories" ON subcategories;
DROP POLICY IF EXISTS "anon_delete_tags" ON tags;
DROP POLICY IF EXISTS "anon_insert_tags" ON tags;
DROP POLICY IF EXISTS "anon_update_tags" ON tags;
DROP POLICY IF EXISTS "anon_delete_template_tags" ON template_tags;
DROP POLICY IF EXISTS "anon_insert_template_tags" ON template_tags;
DROP POLICY IF EXISTS "anon_insert_template_versions" ON template_versions;
DROP POLICY IF EXISTS "anon_delete_ticket_tags" ON ticket_tags;
DROP POLICY IF EXISTS "anon_insert_ticket_tags" ON ticket_tags;
DROP POLICY IF EXISTS "anon_delete_tickets" ON tickets;
DROP POLICY IF EXISTS "anon_insert_tickets" ON tickets;
DROP POLICY IF EXISTS "anon_update_tickets" ON tickets;
