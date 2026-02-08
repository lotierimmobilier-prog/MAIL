/*
  # EmailOps - Row Level Security Policies

  1. Security Changes
    - Enable RLS on all tables
    - Add role-based policies:
      - Admins: full access to all resources
      - Managers: manage teams and assigned mailboxes
      - Agents: read/write on permitted mailboxes
      - ReadOnly: read-only on permitted mailboxes
    - Audit log: insert-only for users, read-only for admins

  2. Important Notes
    - All policies check auth.uid() for authentication
    - Mailbox-scoped resources check mailbox_permissions
    - Admins bypass mailbox permission checks
*/

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins and managers can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Profile auto-creation on signup"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Categories RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read categories"
  ON categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage categories insert"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage categories update"
  ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage categories delete"
  ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- Subcategories RLS
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read subcategories"
  ON subcategories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage subcategories insert"
  ON subcategories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage subcategories update"
  ON subcategories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage subcategories delete"
  ON subcategories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- Tags RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tags"
  ON tags FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage tags insert"
  ON tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage tags update"
  ON tags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage tags delete"
  ON tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- Mailboxes RLS
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitted users read mailboxes"
  ON mailboxes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins insert mailboxes"
  ON mailboxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update mailboxes"
  ON mailboxes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete mailboxes"
  ON mailboxes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Mailbox permissions RLS
ALTER TABLE mailbox_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own permissions"
  ON mailbox_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all permissions"
  ON mailbox_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert permissions"
  ON mailbox_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update permissions"
  ON mailbox_permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete permissions"
  ON mailbox_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Tickets RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read permitted tickets"
  ON tickets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Agents insert tickets"
  ON tickets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Agents update permitted tickets"
  ON tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
  );

-- Ticket tags RLS
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read ticket tags"
  ON ticket_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ticket_tags.ticket_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Agents insert ticket tags"
  ON ticket_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ticket_tags.ticket_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Agents delete ticket tags"
  ON ticket_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ticket_tags.ticket_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Emails RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read permitted emails"
  ON emails FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = emails.mailbox_id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Senders insert emails"
  ON emails FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = emails.mailbox_id AND mp.user_id = auth.uid() AND mp.can_send = true)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Attachments RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read permitted attachments"
  ON attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails e JOIN mailbox_permissions mp ON mp.mailbox_id = e.mailbox_id
      WHERE e.id = attachments.email_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Senders insert attachments"
  ON attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails e JOIN mailbox_permissions mp ON mp.mailbox_id = e.mailbox_id
      WHERE e.id = attachments.email_id AND mp.user_id = auth.uid() AND mp.can_send = true
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- AI Classifications RLS
ALTER TABLE ai_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read permitted classifications"
  ON ai_classifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ai_classifications.ticket_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Authenticated insert classifications"
  ON ai_classifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Email Templates RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read templates"
  ON email_templates FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Agents insert templates"
  ON email_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'agent')));

CREATE POLICY "Template owners and admins update"
  ON email_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
    OR created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
    OR created_by = auth.uid()
  );

CREATE POLICY "Admins delete templates"
  ON email_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Template tags RLS
ALTER TABLE template_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read template tags"
  ON template_tags FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editors insert template tags"
  ON template_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'agent')));

CREATE POLICY "Admins delete template tags"
  ON template_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- Template versions RLS
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read template versions"
  ON template_versions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert template versions"
  ON template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'agent')));

-- Internal Notes RLS
ALTER TABLE internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read notes for permitted tickets"
  ON internal_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = internal_notes.ticket_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Authors insert notes"
  ON internal_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
        WHERE t.id = internal_notes.ticket_id AND mp.user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY "Authors update own notes"
  ON internal_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Audit Log RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Authenticated insert audit entries"
  ON audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
