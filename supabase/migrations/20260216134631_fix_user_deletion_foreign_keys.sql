/*
  # Correction des contraintes de clés étrangères pour la suppression d'utilisateurs

  1. Problème identifié
    - Les contraintes de clés étrangères vers profiles(id) sont en NO ACTION
    - Cela empêche la suppression d'utilisateurs même si les colonnes sont nullables
    
  2. Solution
    - Changer toutes les contraintes vers ON DELETE SET NULL pour les colonnes nullables
    - Permet la suppression d'utilisateurs sans erreur
    - Préserve les données historiques en mettant NULL à la place de l'ID supprimé
    
  3. Tables corrigées
    - tickets (assignee_id, last_read_by)
    - email_templates (created_by, updated_by)
    - template_versions (changed_by)
    - internal_notes (author_id)
    - audit_log (user_id)
    - system_settings (updated_by)
    - knowledge_base_items (created_by)
    - ai_response_suggestions (reviewed_by)
    
  4. Sécurité
    - Les données ne sont pas perdues
    - Les références deviennent NULL quand un utilisateur est supprimé
    - Les tables avec CASCADE (notifications, user_signatures, mailbox_permissions) restent inchangées
*/

-- Tickets: assignee_id
DO $$
BEGIN
  ALTER TABLE tickets
    DROP CONSTRAINT IF EXISTS tickets_assignee_id_fkey;
  
  ALTER TABLE tickets
    ADD CONSTRAINT tickets_assignee_id_fkey
    FOREIGN KEY (assignee_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Tickets: last_read_by
DO $$
BEGIN
  ALTER TABLE tickets
    DROP CONSTRAINT IF EXISTS tickets_last_read_by_fkey;
  
  ALTER TABLE tickets
    ADD CONSTRAINT tickets_last_read_by_fkey
    FOREIGN KEY (last_read_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Email templates: created_by
DO $$
BEGIN
  ALTER TABLE email_templates
    DROP CONSTRAINT IF EXISTS email_templates_created_by_fkey;
  
  ALTER TABLE email_templates
    ADD CONSTRAINT email_templates_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Email templates: updated_by
DO $$
BEGIN
  ALTER TABLE email_templates
    DROP CONSTRAINT IF EXISTS email_templates_updated_by_fkey;
  
  ALTER TABLE email_templates
    ADD CONSTRAINT email_templates_updated_by_fkey
    FOREIGN KEY (updated_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Template versions: changed_by
DO $$
BEGIN
  ALTER TABLE template_versions
    DROP CONSTRAINT IF EXISTS template_versions_changed_by_fkey;
  
  ALTER TABLE template_versions
    ADD CONSTRAINT template_versions_changed_by_fkey
    FOREIGN KEY (changed_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Internal notes: author_id  
DO $$
BEGIN
  ALTER TABLE internal_notes
    DROP CONSTRAINT IF EXISTS internal_notes_author_id_fkey;
  
  ALTER TABLE internal_notes
    ADD CONSTRAINT internal_notes_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Audit log: user_id
DO $$
BEGIN
  ALTER TABLE audit_log
    DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
  
  ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- System settings: updated_by
DO $$
BEGIN
  ALTER TABLE system_settings
    DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
  
  ALTER TABLE system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey
    FOREIGN KEY (updated_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- Knowledge base items: created_by
DO $$
BEGIN
  ALTER TABLE knowledge_base_items
    DROP CONSTRAINT IF EXISTS knowledge_base_items_created_by_fkey;
  
  ALTER TABLE knowledge_base_items
    ADD CONSTRAINT knowledge_base_items_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;

-- AI response suggestions: reviewed_by
DO $$
BEGIN
  ALTER TABLE ai_response_suggestions
    DROP CONSTRAINT IF EXISTS ai_response_suggestions_reviewed_by_fkey;
  
  ALTER TABLE ai_response_suggestions
    ADD CONSTRAINT ai_response_suggestions_reviewed_by_fkey
    FOREIGN KEY (reviewed_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
END $$;
