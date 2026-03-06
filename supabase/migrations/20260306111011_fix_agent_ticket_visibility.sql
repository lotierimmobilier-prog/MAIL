/*
  # Corriger la visibilité des tickets pour les agents

  1. Modification des Politiques RLS
    - Tickets: Ajouter vérification que can_read = true
    - Emails: Ajouter vérification que can_read = true
    - Internal notes: Ajouter vérification
    - Attachments: Ajouter vérification

  2. Amélioration
    - Les agents voient les tickets uniquement si can_read = true
    - Les agents voient les emails uniquement si can_read = true
    - Les managers voient tous les tickets/emails
    - Les admins voient tous les tickets/emails

  3. Important
    - Cette migration corrige la restriction trop stricte
    - Les agents avec can_read = true verront les données
*/

-- ============================================================================
-- 1. CORRIGER LA POLITIQUE RLS POUR LES TICKETS
-- ============================================================================

DROP POLICY IF EXISTS "Users read permitted tickets" ON tickets;
CREATE POLICY "Users read permitted tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = tickets.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  );

-- ============================================================================
-- 2. CORRIGER LA POLITIQUE RLS POUR L'INSERTION DE TICKETS
-- ============================================================================

DROP POLICY IF EXISTS "Agents insert tickets" ON tickets;
CREATE POLICY "Agents insert tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = tickets.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  );

-- ============================================================================
-- 3. CORRIGER LA POLITIQUE RLS POUR LA MISE À JOUR DE TICKETS
-- ============================================================================

DROP POLICY IF EXISTS "Agents update permitted tickets" ON tickets;
CREATE POLICY "Agents update permitted tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = tickets.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = tickets.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  );

-- ============================================================================
-- 4. VÉRIFIER ET CORRIGER LES POLITIQUES POUR LES EMAILS
-- ============================================================================

DROP POLICY IF EXISTS "Users read permitted emails" ON emails;
CREATE POLICY "Users read permitted emails"
  ON emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = emails.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  );

DROP POLICY IF EXISTS "Users insert emails" ON emails;
CREATE POLICY "Users insert emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = emails.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Agents can send emails" ON emails;
CREATE POLICY "Agents can send emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (
    direction = 'inbound'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = emails.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_send = true
    )
  );

-- ============================================================================
-- 5. CORRIGER LES POLITIQUES POUR LES NOTES INTERNES
-- ============================================================================

DROP POLICY IF EXISTS "Users read internal notes" ON internal_notes;
CREATE POLICY "Users read internal notes"
  ON internal_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM tickets t
      JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
      WHERE t.id = internal_notes.ticket_id
      AND mp.user_id = (SELECT auth.uid())
      AND mp.can_read = true
    )
  );

DROP POLICY IF EXISTS "Users insert internal notes" ON internal_notes;
CREATE POLICY "Users insert internal notes"
  ON internal_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'manager')
      )
      OR EXISTS (
        SELECT 1 FROM tickets t
        JOIN mailbox_permissions mp ON mp.mailbox_id = t.mailbox_id
        WHERE t.id = internal_notes.ticket_id
        AND mp.user_id = (SELECT auth.uid())
        AND mp.can_read = true
      )
    )
  );

-- ============================================================================
-- 6. CORRIGER LES POLITIQUES POUR LES ATTACHMENTS
-- ============================================================================

DROP POLICY IF EXISTS "Users read attachments" ON attachments;
CREATE POLICY "Users read attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM emails e
      JOIN mailbox_permissions mp ON mp.mailbox_id = e.mailbox_id
      WHERE e.id = attachments.email_id
      AND mp.user_id = (SELECT auth.uid())
      AND mp.can_read = true
    )
  );
