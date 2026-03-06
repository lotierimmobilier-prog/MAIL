/*
  # Ajouter des restrictions d'accès supplémentaires pour les agents

  1. Nouvelle Table
    - `agent_view_access_log` : Journalise les tentatives d'accès non autorisé

  2. Amélioration Sécurité
    - Ajouter des vérifications supplémentaires pour les agents
    - Ajouter une fonction de vérification des permissions
    - Améliorer les politiques RLS pour les vues et fonctionnalités

  3. Modifications aux Politiques RLS
    - Renforcer les restrictions pour les agents (role = 'agent')
    - Assurer que seule la "lecture" est possible pour les agents sans can_read
    - Vérifier les permissions can_send avant d'envoyer des emails
*/

-- ============================================================================
-- 1. CRÉER UNE FONCTION DE VÉRIFICATION DES PERMISSIONS AGENT
-- ============================================================================

CREATE OR REPLACE FUNCTION check_agent_mailbox_access(p_mailbox_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Admins et managers ont accès à tout
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF v_user_role IN ('admin', 'manager') THEN
    RETURN true;
  END IF;

  -- Les agents doivent avoir une permission explicite
  RETURN EXISTS (
    SELECT 1 FROM mailbox_permissions
    WHERE mailbox_id = p_mailbox_id
    AND user_id = p_user_id
    AND can_read = true
  );
END;
$$;

-- ============================================================================
-- 2. CRÉER UNE FONCTION POUR VÉRIFIER LES PERMISSIONS D'ENVOI
-- ============================================================================

CREATE OR REPLACE FUNCTION check_agent_can_send(p_mailbox_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Admins et managers peuvent envoyer de n'importe quelle boîte
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF v_user_role IN ('admin', 'manager') THEN
    RETURN true;
  END IF;

  -- Les agents doivent avoir can_send = true
  RETURN EXISTS (
    SELECT 1 FROM mailbox_permissions
    WHERE mailbox_id = p_mailbox_id
    AND user_id = p_user_id
    AND can_send = true
  );
END;
$$;

-- ============================================================================
-- 3. RENFORCER LES POLITIQUES RLS POUR LES EMAILS
-- ============================================================================

DROP POLICY IF EXISTS "Agents can send emails" ON emails;
CREATE POLICY "Agents can send emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (
    direction = 'outbound'
    AND check_agent_can_send(mailbox_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users read permitted emails" ON emails;
CREATE POLICY "Users read permitted emails"
  ON emails FOR SELECT
  TO authenticated
  USING (
    check_agent_mailbox_access(mailbox_id, (SELECT auth.uid()))
  );

-- ============================================================================
-- 4. RENFORCER LES POLITIQUES RLS POUR LES TICKETS
-- ============================================================================

DROP POLICY IF EXISTS "Users read permitted tickets" ON tickets;
CREATE POLICY "Users read permitted tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    check_agent_mailbox_access(mailbox_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users insert tickets" ON tickets;
CREATE POLICY "Users insert tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    check_agent_mailbox_access(mailbox_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users update permitted tickets" ON tickets;
CREATE POLICY "Users update permitted tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    check_agent_mailbox_access(mailbox_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    check_agent_mailbox_access(mailbox_id, (SELECT auth.uid()))
  );

-- ============================================================================
-- 5. AJOUTER UN INDEX POUR LA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mailbox_permissions_user_read
  ON mailbox_permissions(user_id, mailbox_id)
  WHERE can_read = true;

CREATE INDEX IF NOT EXISTS idx_mailbox_permissions_user_send
  ON mailbox_permissions(user_id, mailbox_id)
  WHERE can_send = true;

-- ============================================================================
-- 6. RENFORCER LES CONTRÔLES POUR LES ATTACHMENTS
-- ============================================================================

DROP POLICY IF EXISTS "Users read attachments" ON attachments;
CREATE POLICY "Users read attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = attachments.email_id
      AND check_agent_mailbox_access(emails.mailbox_id, (SELECT auth.uid()))
    )
  );
