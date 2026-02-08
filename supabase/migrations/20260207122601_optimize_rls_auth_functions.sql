/*
  # Optimize RLS Auth Function Calls

  1. Performance Optimization
    - Replace auth.uid() with (SELECT auth.uid()) in all policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale
    
  2. Changes
    - Drop and recreate all existing RLS policies with optimized auth calls
    - Maintain exact same security rules, only optimize performance
*/

-- Profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins and managers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Profile auto-creation on signup" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins and managers can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Profile auto-creation on signup"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- Categories policies
DROP POLICY IF EXISTS "Authenticated read categories" ON categories;
DROP POLICY IF EXISTS "Admins manage categories insert" ON categories;
DROP POLICY IF EXISTS "Admins manage categories update" ON categories;
DROP POLICY IF EXISTS "Admins manage categories delete" ON categories;

CREATE POLICY "Authenticated read categories"
  ON categories FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admins manage categories insert"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage categories update"
  ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage categories delete"
  ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

-- Subcategories policies
DROP POLICY IF EXISTS "Authenticated read subcategories" ON subcategories;
DROP POLICY IF EXISTS "Admins manage subcategories insert" ON subcategories;
DROP POLICY IF EXISTS "Admins manage subcategories update" ON subcategories;
DROP POLICY IF EXISTS "Admins manage subcategories delete" ON subcategories;

CREATE POLICY "Authenticated read subcategories"
  ON subcategories FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admins manage subcategories insert"
  ON subcategories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage subcategories update"
  ON subcategories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage subcategories delete"
  ON subcategories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

-- Tags policies
DROP POLICY IF EXISTS "Authenticated read tags" ON tags;
DROP POLICY IF EXISTS "Admins manage tags insert" ON tags;
DROP POLICY IF EXISTS "Admins manage tags update" ON tags;
DROP POLICY IF EXISTS "Admins manage tags delete" ON tags;

CREATE POLICY "Authenticated read tags"
  ON tags FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admins manage tags insert"
  ON tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage tags update"
  ON tags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

CREATE POLICY "Admins manage tags delete"
  ON tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

-- Mailboxes policies
DROP POLICY IF EXISTS "Permitted users read mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "Admins insert mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "Admins update mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "Admins delete mailboxes" ON mailboxes;

CREATE POLICY "Permitted users read mailboxes"
  ON mailboxes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = id AND mp.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Admins insert mailboxes"
  ON mailboxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Admins update mailboxes"
  ON mailboxes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Admins delete mailboxes"
  ON mailboxes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- Mailbox permissions policies
DROP POLICY IF EXISTS "Users read own permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "Admins read all permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "Admins insert permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "Admins update permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "Admins delete permissions" ON mailbox_permissions;

CREATE POLICY "Users read own permissions"
  ON mailbox_permissions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins read all permissions"
  ON mailbox_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Admins insert permissions"
  ON mailbox_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Admins update permissions"
  ON mailbox_permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Admins delete permissions"
  ON mailbox_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- Tickets policies
DROP POLICY IF EXISTS "Users read permitted tickets" ON tickets;
DROP POLICY IF EXISTS "Agents insert tickets" ON tickets;
DROP POLICY IF EXISTS "Agents update permitted tickets" ON tickets;

CREATE POLICY "Users read permitted tickets"
  ON tickets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Agents insert tickets"
  ON tickets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Agents update permitted tickets"
  ON tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = tickets.mailbox_id AND mp.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager'))
  );

-- Ticket tags policies
DROP POLICY IF EXISTS "Users read ticket tags" ON ticket_tags;
DROP POLICY IF EXISTS "Agents insert ticket tags" ON ticket_tags;
DROP POLICY IF EXISTS "Agents delete ticket tags" ON ticket_tags;

CREATE POLICY "Users read ticket tags"
  ON ticket_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ticket_tags.ticket_id AND mp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Agents insert ticket tags"
  ON ticket_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ticket_tags.ticket_id AND mp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Agents delete ticket tags"
  ON ticket_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ticket_tags.ticket_id AND mp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

-- Emails policies
DROP POLICY IF EXISTS "Users read permitted emails" ON emails;
DROP POLICY IF EXISTS "Senders insert emails" ON emails;

CREATE POLICY "Users read permitted emails"
  ON emails FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = emails.mailbox_id AND mp.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Senders insert emails"
  ON emails FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM mailbox_permissions mp WHERE mp.mailbox_id = emails.mailbox_id AND mp.user_id = (SELECT auth.uid()) AND mp.can_send = true)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

-- Attachments policies
DROP POLICY IF EXISTS "Users read permitted attachments" ON attachments;
DROP POLICY IF EXISTS "Senders insert attachments" ON attachments;

CREATE POLICY "Users read permitted attachments"
  ON attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails e JOIN mailbox_permissions mp ON mp.mailbox_id = e.mailbox_id
      WHERE e.id = attachments.email_id AND mp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Senders insert attachments"
  ON attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails e JOIN mailbox_permissions mp ON mp.mailbox_id = e.mailbox_id
      WHERE e.id = attachments.email_id AND mp.user_id = (SELECT auth.uid()) AND mp.can_send = true
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

-- AI Classifications policies
DROP POLICY IF EXISTS "Users read permitted classifications" ON ai_classifications;
DROP POLICY IF EXISTS "Authenticated insert classifications" ON ai_classifications;

CREATE POLICY "Users read permitted classifications"
  ON ai_classifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = ai_classifications.ticket_id AND mp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Authenticated insert classifications"
  ON ai_classifications FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Email Templates policies
DROP POLICY IF EXISTS "Authenticated read templates" ON email_templates;
DROP POLICY IF EXISTS "Agents insert templates" ON email_templates;
DROP POLICY IF EXISTS "Template owners and admins update" ON email_templates;
DROP POLICY IF EXISTS "Admins delete templates" ON email_templates;

CREATE POLICY "Authenticated read templates"
  ON email_templates FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Agents insert templates"
  ON email_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager', 'agent')));

CREATE POLICY "Template owners and admins update"
  ON email_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager'))
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager'))
    OR created_by = (SELECT auth.uid())
  );

CREATE POLICY "Admins delete templates"
  ON email_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- Template tags policies
DROP POLICY IF EXISTS "Authenticated read template tags" ON template_tags;
DROP POLICY IF EXISTS "Editors insert template tags" ON template_tags;
DROP POLICY IF EXISTS "Admins delete template tags" ON template_tags;

CREATE POLICY "Authenticated read template tags"
  ON template_tags FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Editors insert template tags"
  ON template_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager', 'agent')));

CREATE POLICY "Admins delete template tags"
  ON template_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager')));

-- Template versions policies
DROP POLICY IF EXISTS "Authenticated read template versions" ON template_versions;
DROP POLICY IF EXISTS "Users insert template versions" ON template_versions;

CREATE POLICY "Authenticated read template versions"
  ON template_versions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Users insert template versions"
  ON template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'manager', 'agent')));

-- Internal Notes policies
DROP POLICY IF EXISTS "Users read notes for permitted tickets" ON internal_notes;
DROP POLICY IF EXISTS "Authors insert notes" ON internal_notes;
DROP POLICY IF EXISTS "Authors update own notes" ON internal_notes;

CREATE POLICY "Users read notes for permitted tickets"
  ON internal_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = internal_notes.ticket_id AND mp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "Authors insert notes"
  ON internal_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM tickets t JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
        WHERE t.id = internal_notes.ticket_id AND mp.user_id = (SELECT auth.uid())
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
    )
  );

CREATE POLICY "Authors update own notes"
  ON internal_notes FOR UPDATE TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

-- Audit Log policies
DROP POLICY IF EXISTS "Admins read audit log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated insert audit entries" ON audit_log;

CREATE POLICY "Admins read audit log"
  ON audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "Authenticated insert audit entries"
  ON audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
