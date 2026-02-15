/*
  # Correction des contraintes pour permettre la suppression d'utilisateurs

  1. Modifications des contraintes de clé étrangère
    - Changement de NO ACTION vers SET NULL pour les relations nullables
    - Permet la suppression d'utilisateurs sans perdre les données historiques
    
  2. Tables affectées
    - tickets (assignee_id, last_read_by)
    - email_templates (created_by, updated_by)
    - template_versions (changed_by)
    - internal_notes (author_id)
    - audit_log (user_id)
    - system_settings (updated_by)
    - knowledge_base_items (created_by)
    - ai_response_suggestions (reviewed_by)
    
  3. Sécurité
    - Les données historiques sont préservées
    - Les références aux utilisateurs supprimés deviennent NULL
    - Les notifications et permissions sont supprimées en cascade (déjà configuré)
*/

-- Tickets: assignee_id
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_assignee_id_fkey,
  ADD CONSTRAINT tickets_assignee_id_fkey
    FOREIGN KEY (assignee_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Tickets: last_read_by
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_last_read_by_fkey,
  ADD CONSTRAINT tickets_last_read_by_fkey
    FOREIGN KEY (last_read_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Email templates: created_by
ALTER TABLE email_templates
  DROP CONSTRAINT IF EXISTS email_templates_created_by_fkey,
  ADD CONSTRAINT email_templates_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Email templates: updated_by
ALTER TABLE email_templates
  DROP CONSTRAINT IF EXISTS email_templates_updated_by_fkey,
  ADD CONSTRAINT email_templates_updated_by_fkey
    FOREIGN KEY (updated_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Template versions: changed_by
ALTER TABLE template_versions
  DROP CONSTRAINT IF EXISTS template_versions_changed_by_fkey,
  ADD CONSTRAINT template_versions_changed_by_fkey
    FOREIGN KEY (changed_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Internal notes: author_id
ALTER TABLE internal_notes
  DROP CONSTRAINT IF EXISTS internal_notes_author_id_fkey,
  ADD CONSTRAINT internal_notes_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Audit log: user_id
ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey,
  ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- System settings: updated_by
ALTER TABLE system_settings
  DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey,
  ADD CONSTRAINT system_settings_updated_by_fkey
    FOREIGN KEY (updated_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Knowledge base items: created_by
ALTER TABLE knowledge_base_items
  DROP CONSTRAINT IF EXISTS knowledge_base_items_created_by_fkey,
  ADD CONSTRAINT knowledge_base_items_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- AI response suggestions: reviewed_by
ALTER TABLE ai_response_suggestions
  DROP CONSTRAINT IF EXISTS ai_response_suggestions_reviewed_by_fkey,
  ADD CONSTRAINT ai_response_suggestions_reviewed_by_fkey
    FOREIGN KEY (reviewed_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
