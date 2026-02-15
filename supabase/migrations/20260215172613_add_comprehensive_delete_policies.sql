/*
  # Ajout des politiques de suppression complètes

  1. Nouvelles politiques DELETE
    - Emails: admins uniquement
    - Profiles: admins uniquement
    - Tickets: admins uniquement
    - Internal notes: admins uniquement
    - Email templates: admins uniquement
    - Mailboxes: admins uniquement
    - Categories: admins uniquement
    - Attachments: admins uniquement
    - AI classifications: admins uniquement
    - Notifications: utilisateurs pour leurs propres notifications
    - Knowledge base items: admins uniquement
    - Autres tables système
  
  2. Sécurité
    - Toutes les politiques vérifient le rôle admin via auth.uid()
    - Les utilisateurs peuvent supprimer leurs propres notifications
    - Suppression en cascade gérée par les contraintes FK
*/

-- Politique DELETE pour les emails (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete emails" ON emails;
CREATE POLICY "Admins can delete emails"
  ON emails
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les profils utilisateurs (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les tickets (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete tickets" ON tickets;
CREATE POLICY "Admins can delete tickets"
  ON tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les notes internes (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete internal notes" ON internal_notes;
CREATE POLICY "Admins can delete internal notes"
  ON internal_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les email templates (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete templates" ON email_templates;
CREATE POLICY "Admins can delete templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les mailboxes (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete mailboxes" ON mailboxes;
CREATE POLICY "Admins can delete mailboxes"
  ON mailboxes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les catégories (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Admins can delete categories"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les pièces jointes (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete attachments" ON attachments;
CREATE POLICY "Admins can delete attachments"
  ON attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les classifications IA (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete AI classifications" ON ai_classifications;
CREATE POLICY "Admins can delete AI classifications"
  ON ai_classifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les notifications (utilisateurs pour leurs propres notifications)
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Politique DELETE pour les admins sur toutes les notifications
DROP POLICY IF EXISTS "Admins can delete all notifications" ON notifications;
CREATE POLICY "Admins can delete all notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les knowledge base items (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete knowledge base items" ON knowledge_base_items;
CREATE POLICY "Admins can delete knowledge base items"
  ON knowledge_base_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les tags (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete tags" ON tags;
CREATE POLICY "Admins can delete tags"
  ON tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les subcategories (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete subcategories" ON subcategories;
CREATE POLICY "Admins can delete subcategories"
  ON subcategories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les mailbox permissions (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete mailbox permissions" ON mailbox_permissions;
CREATE POLICY "Admins can delete mailbox permissions"
  ON mailbox_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les sync jobs (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete sync jobs" ON sync_jobs;
CREATE POLICY "Admins can delete sync jobs"
  ON sync_jobs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Politique DELETE pour les AI response suggestions (admins uniquement)
DROP POLICY IF EXISTS "Admins can delete AI suggestions" ON ai_response_suggestions;
CREATE POLICY "Admins can delete AI suggestions"
  ON ai_response_suggestions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );
