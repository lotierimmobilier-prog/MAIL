/*
  # Add Foreign Key Indexes for Performance

  1. Changes
    - Add indexes on all foreign key columns that were missing indexes
    - This improves query performance for JOIN operations
    
  2. Indexes Added
    - ai_classifications(email_id)
    - attachments(email_id)
    - email_templates(category_id, mailbox_id, created_by, updated_by)
    - emails(mailbox_id)
    - internal_notes(author_id)
    - mailbox_permissions(user_id)
    - template_tags(tag_id)
    - template_versions(changed_by)
    - ticket_tags(tag_id)
    - tickets(subcategory_id)
*/

CREATE INDEX IF NOT EXISTS idx_ai_classifications_email_id ON ai_classifications(email_id);
CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category_id ON email_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_mailbox_id ON email_templates(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by ON email_templates(updated_by);
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_internal_notes_author_id ON internal_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_permissions_user_id ON mailbox_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_template_tags_tag_id ON template_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_changed_by ON template_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tickets_subcategory_id ON tickets(subcategory_id);
