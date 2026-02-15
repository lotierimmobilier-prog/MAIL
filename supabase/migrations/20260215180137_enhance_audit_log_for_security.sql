/*
  # Amélioration de l'audit log pour la sécurité

  1. Nouveaux champs pour traçabilité complète
    - `ip_address`: Adresse IP de l'utilisateur
    - `user_agent`: User agent du navigateur
    - `session_id`: Identifiant de session
    - `risk_score`: Score de risque (0-100)
    - `metadata`: Données supplémentaires (JSON)
    
  2. Index pour performances
    - Index sur ip_address pour détecter les attaques
    - Index sur created_at pour recherches temporelles
    - Index composite user_id + created_at
    
  3. Actions critiques à logger
    - login_success / login_failed
    - logout
    - password_changed
    - email_changed
    - mfa_enabled / mfa_disabled
    - role_changed
    - permission_granted / permission_revoked
    - credential_accessed
    - data_exported
    - mailbox_created / mailbox_updated / mailbox_deleted
    - user_created / user_deleted
    
  4. Politique de rétention
    - Conserver tous les logs de sécurité pendant 1 an minimum
    - Logs immuables (pas de UPDATE/DELETE sauf par admin système)
*/

-- Ajouter les nouveaux champs si ils n'existent pas
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_audit_log_ip_address ON audit_log(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_time ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk_score ON audit_log(risk_score DESC, created_at DESC) WHERE risk_score > 50;
CREATE INDEX IF NOT EXISTS idx_audit_log_session ON audit_log(session_id, created_at DESC) WHERE session_id IS NOT NULL;

-- Créer une vue pour les événements de sécurité critiques
CREATE OR REPLACE VIEW security_events AS
SELECT
  al.id,
  al.user_id,
  p.email as user_email,
  p.full_name as user_name,
  p.role as user_role,
  al.action,
  al.resource_type,
  al.resource_id,
  al.ip_address,
  al.user_agent,
  al.risk_score,
  al.details,
  al.metadata,
  al.created_at
FROM audit_log al
LEFT JOIN profiles p ON al.user_id = p.id
WHERE al.action IN (
  'login_success', 'login_failed', 'logout',
  'password_changed', 'email_changed',
  'mfa_enabled', 'mfa_disabled',
  'role_changed', 'permission_granted', 'permission_revoked',
  'credential_accessed', 'credential_decrypted',
  'data_exported', 'mailbox_deleted', 'user_deleted'
)
ORDER BY al.created_at DESC;

-- Fonction pour calculer le score de risque
CREATE OR REPLACE FUNCTION calculate_risk_score(
  p_user_id UUID,
  p_action TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT
) RETURNS INT AS $$
DECLARE
  v_risk_score INT := 0;
  v_failed_logins INT;
  v_unusual_ip BOOLEAN;
  v_unusual_time BOOLEAN;
  v_unusual_location BOOLEAN;
BEGIN
  -- Actions sensibles : +30 points
  IF p_action IN ('credential_accessed', 'credential_decrypted', 'data_exported', 'user_deleted', 'mailbox_deleted') THEN
    v_risk_score := v_risk_score + 30;
  END IF;

  -- Échec de connexion : +20 points
  IF p_action = 'login_failed' THEN
    v_risk_score := v_risk_score + 20;
    
    -- Vérifier le nombre d'échecs récents
    SELECT COUNT(*) INTO v_failed_logins
    FROM audit_log
    WHERE action = 'login_failed'
      AND (user_id = p_user_id OR ip_address = p_ip_address)
      AND created_at > NOW() - INTERVAL '15 minutes';
    
    -- Multiples échecs : +10 points par échec supplémentaire
    IF v_failed_logins > 3 THEN
      v_risk_score := v_risk_score + (v_failed_logins - 3) * 10;
    END IF;
  END IF;

  -- IP inhabituelle : +25 points
  IF p_user_id IS NOT NULL AND p_ip_address IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM audit_log
      WHERE user_id = p_user_id
        AND ip_address = p_ip_address
        AND action = 'login_success'
        AND created_at > NOW() - INTERVAL '30 days'
    ) INTO v_unusual_ip;
    
    IF v_unusual_ip THEN
      v_risk_score := v_risk_score + 25;
    END IF;
  END IF;

  -- Heure inhabituelle (entre 23h et 6h) : +15 points
  IF EXTRACT(HOUR FROM NOW()) >= 23 OR EXTRACT(HOUR FROM NOW()) < 6 THEN
    v_risk_score := v_risk_score + 15;
  END IF;

  -- Limiter le score à 100
  IF v_risk_score > 100 THEN
    v_risk_score := 100;
  END IF;

  RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour enregistrer un événement d'audit avec calcul automatique du risque
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_risk_score INT;
  v_audit_id UUID;
BEGIN
  -- Calculer le score de risque
  v_risk_score := calculate_risk_score(p_user_id, p_action, p_ip_address, p_user_agent);

  -- Insérer l'événement d'audit
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    session_id,
    risk_score,
    details,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_session_id,
    v_risk_score,
    p_details,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_audit_id;

  -- Si le score de risque est élevé, créer une notification
  IF v_risk_score >= 70 THEN
    -- Notifier tous les admins
    INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
    SELECT
      p.id,
      'security_alert',
      'Alerte sécurité : Activité suspecte détectée',
      format('Action "%s" avec un score de risque de %s détectée.', p_action, v_risk_score),
      jsonb_build_object(
        'audit_id', v_audit_id,
        'risk_score', v_risk_score,
        'action', p_action,
        'ip_address', p_ip_address
      ),
      NOW()
    FROM profiles p
    WHERE p.role = 'admin';
  END IF;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires pour documentation
COMMENT ON COLUMN audit_log.ip_address IS 'Adresse IP de l''utilisateur lors de l''action';
COMMENT ON COLUMN audit_log.user_agent IS 'User agent du navigateur de l''utilisateur';
COMMENT ON COLUMN audit_log.session_id IS 'Identifiant de la session utilisateur';
COMMENT ON COLUMN audit_log.risk_score IS 'Score de risque calculé automatiquement (0-100)';
COMMENT ON COLUMN audit_log.metadata IS 'Données supplémentaires au format JSON';

COMMENT ON FUNCTION log_security_event IS 'Enregistre un événement de sécurité avec calcul automatique du score de risque et notifications';
COMMENT ON FUNCTION calculate_risk_score IS 'Calcule un score de risque (0-100) basé sur l''action, l''historique et le contexte';
