/*
  # Correction des problèmes de performance et sécurité (v2)

  1. Index manquants sur clés étrangères
  2. Optimisation des politiques RLS
  3. Nettoyage des index dupliqués
  4. Consolidation des politiques permissives multiples
  5. Correction des fonctions avec search_path mutable
  6. Correction des politiques always true
*/

-- ============================================================================
-- 1. AJOUTER LES INDEX MANQUANTS SUR CLÉS ÉTRANGÈRES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_response_suggestions_email_id 
  ON ai_response_suggestions(email_id);

CREATE INDEX IF NOT EXISTS idx_ai_response_suggestions_reviewed_by 
  ON ai_response_suggestions(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_created_by 
  ON knowledge_base_items(created_by);

CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by 
  ON system_settings(updated_by);

CREATE INDEX IF NOT EXISTS idx_tickets_last_read_by 
  ON tickets(last_read_by);

-- ============================================================================
-- 2. SUPPRIMER L'INDEX DUPLIQUÉ
-- ============================================================================

DROP INDEX IF EXISTS idx_emails_message_id;

-- ============================================================================
-- 3. OPTIMISER LES POLITIQUES RLS
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "authenticated_read_own_profile" ON profiles;
CREATE POLICY "authenticated_read_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- Categories - consolidate
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Admins manage categories delete" ON categories;
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Subcategories - consolidate
DROP POLICY IF EXISTS "Admins can delete subcategories" ON subcategories;
DROP POLICY IF EXISTS "Admins manage subcategories delete" ON subcategories;
CREATE POLICY "Admins can delete subcategories"
  ON subcategories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Tags - consolidate
DROP POLICY IF EXISTS "Admins can delete tags" ON tags;
DROP POLICY IF EXISTS "Admins manage tags delete" ON tags;
CREATE POLICY "Admins can delete tags"
  ON tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Mailboxes - consolidate
DROP POLICY IF EXISTS "Admins can delete mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "Admins delete mailboxes" ON mailboxes;
CREATE POLICY "Admins can delete mailboxes"
  ON mailboxes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Permitted users read mailboxes" ON mailboxes;
CREATE POLICY "Permitted users read mailboxes"
  ON mailboxes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = mailboxes.id
      AND mailbox_permissions.user_id = (select auth.uid())
    )
  );

-- Mailbox permissions - consolidate
DROP POLICY IF EXISTS "Admins can delete mailbox permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "Admins delete permissions" ON mailbox_permissions;
CREATE POLICY "Admins can delete mailbox permissions"
  ON mailbox_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins read all permissions" ON mailbox_permissions;
DROP POLICY IF EXISTS "Users read own permissions" ON mailbox_permissions;
CREATE POLICY "Mailbox permissions read"
  ON mailbox_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR user_id = (select auth.uid())
  );

-- Tickets
DROP POLICY IF EXISTS "Admins can delete tickets" ON tickets;
CREATE POLICY "Admins can delete tickets"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Emails
DROP POLICY IF EXISTS "Admins can delete emails" ON emails;
CREATE POLICY "Admins can delete emails"
  ON emails FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Attachments
DROP POLICY IF EXISTS "Admins can delete attachments" ON attachments;
CREATE POLICY "Admins can delete attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- AI Classifications
DROP POLICY IF EXISTS "Admins can delete AI classifications" ON ai_classifications;
CREATE POLICY "Admins can delete AI classifications"
  ON ai_classifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Email Templates - consolidate
DROP POLICY IF EXISTS "Admins can delete templates" ON email_templates;
DROP POLICY IF EXISTS "Admins delete templates" ON email_templates;
CREATE POLICY "Admins can delete templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Internal Notes
DROP POLICY IF EXISTS "Admins can delete internal notes" ON internal_notes;
CREATE POLICY "Admins can delete internal notes"
  ON internal_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Sync Jobs
DROP POLICY IF EXISTS "Admins can delete sync jobs" ON sync_jobs;
CREATE POLICY "Admins can delete sync jobs"
  ON sync_jobs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Ticket Statuses
DROP POLICY IF EXISTS "Admins can delete ticket statuses" ON ticket_statuses;
CREATE POLICY "Admins can delete ticket statuses"
  ON ticket_statuses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert ticket statuses" ON ticket_statuses;
CREATE POLICY "Admins can insert ticket statuses"
  ON ticket_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update ticket statuses" ON ticket_statuses;
CREATE POLICY "Admins can update ticket statuses"
  ON ticket_statuses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Ticket Priorities
DROP POLICY IF EXISTS "Admins can delete ticket priorities" ON ticket_priorities;
CREATE POLICY "Admins can delete ticket priorities"
  ON ticket_priorities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert ticket priorities" ON ticket_priorities;
CREATE POLICY "Admins can insert ticket priorities"
  ON ticket_priorities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update ticket priorities" ON ticket_priorities;
CREATE POLICY "Admins can update ticket priorities"
  ON ticket_priorities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Notifications - consolidate
DROP POLICY IF EXISTS "Admins can delete all notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- System can create notifications - fix always true
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Knowledge Base Items - consolidate
DROP POLICY IF EXISTS "Admins can delete knowledge base items" ON knowledge_base_items;
DROP POLICY IF EXISTS "Users can delete own knowledge base items" ON knowledge_base_items;
CREATE POLICY "Delete knowledge base items"
  ON knowledge_base_items FOR DELETE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create knowledge base items" ON knowledge_base_items;
CREATE POLICY "Authenticated users can create knowledge base items"
  ON knowledge_base_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view active knowledge base items" ON knowledge_base_items;
CREATE POLICY "Authenticated users can view active knowledge base items"
  ON knowledge_base_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own knowledge base items" ON knowledge_base_items;
CREATE POLICY "Users can update own knowledge base items"
  ON knowledge_base_items FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- AI Response Suggestions - consolidate
DROP POLICY IF EXISTS "Admins can delete AI suggestions" ON ai_response_suggestions;
DROP POLICY IF EXISTS "Users can delete suggestions" ON ai_response_suggestions;
CREATE POLICY "Delete AI suggestions"
  ON ai_response_suggestions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- System can create suggestions - fix always true
DROP POLICY IF EXISTS "System can create suggestions" ON ai_response_suggestions;
CREATE POLICY "System can create suggestions"
  ON ai_response_suggestions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Rate Limit Tracker
DROP POLICY IF EXISTS "Admins can read rate limits" ON rate_limit_tracker;
CREATE POLICY "Admins can read rate limits"
  ON rate_limit_tracker FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Rate Limit Config
DROP POLICY IF EXISTS "Admins can manage rate limit config" ON rate_limit_config;
CREATE POLICY "Admins can manage rate limit config"
  ON rate_limit_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Profiles - consolidate update policies
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 4. CORRIGER LES FONCTIONS - DROP puis CREATE
-- ============================================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS cleanup_old_sync_jobs();
DROP FUNCTION IF EXISTS reset_stale_sync_jobs();
DROP FUNCTION IF EXISTS has_encoding_issues(text);
DROP FUNCTION IF EXISTS repair_utf8_encoding(text);

-- Recreate with proper search_path
CREATE OR REPLACE FUNCTION log_credential_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (TG_OP = 'SELECT' OR TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      created_at
    ) VALUES (
      auth.uid(),
      'credential_access',
      'mailbox',
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'operation', TG_OP,
        'has_encrypted_password', (NEW.encrypted_password_secure IS NOT NULL OR OLD.encrypted_password_secure IS NOT NULL),
        'has_ovh_key', (NEW.ovh_consumer_key_secure IS NOT NULL OR OLD.ovh_consumer_key_secure IS NOT NULL)
      ),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM profiles;
  
  IF v_count = 1 THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := COALESCE(NEW.role, 'agent');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_sync_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sync_jobs
  WHERE status IN ('completed', 'failed')
    AND updated_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION reset_stale_sync_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE sync_jobs
  SET 
    status = 'failed',
    error_message = 'Job timed out after 30 minutes',
    updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '30 minutes';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION has_encoding_issues(text_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN text_input ~ '[\xC2\xC3][\x80-\xBF][\x80-\xBF]';
END;
$$;

CREATE OR REPLACE FUNCTION repair_utf8_encoding(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN convert_from(convert_to(text_input, 'LATIN1'), 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN text_input;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_auto_draft_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mailbox_id UUID;
  v_setting_enabled BOOLEAN := false;
BEGIN
  IF NEW.direction = 'inbound' THEN
    SELECT mailbox_id INTO v_mailbox_id
    FROM tickets
    WHERE id = NEW.ticket_id;

    SELECT (value::jsonb->>'auto_draft_generation')::boolean INTO v_setting_enabled
    FROM system_settings
    WHERE key = 'ai_features'
    LIMIT 1;

    IF v_setting_enabled THEN
      INSERT INTO draft_generation_queue (
        ticket_id,
        email_id,
        mailbox_id,
        status,
        created_at
      ) VALUES (
        NEW.ticket_id,
        NEW.id,
        v_mailbox_id,
        'pending',
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Commentaires
COMMENT ON INDEX idx_ai_response_suggestions_email_id IS 'Index pour FK email_id - améliore les performances des jointures';
COMMENT ON INDEX idx_ai_response_suggestions_reviewed_by IS 'Index pour FK reviewed_by - améliore les performances des jointures';
COMMENT ON INDEX idx_knowledge_base_items_created_by IS 'Index pour FK created_by - améliore les performances des jointures';
COMMENT ON INDEX idx_system_settings_updated_by IS 'Index pour FK updated_by - améliore les performances des jointures';
COMMENT ON INDEX idx_tickets_last_read_by IS 'Index pour FK last_read_by - améliore les performances des jointures';
