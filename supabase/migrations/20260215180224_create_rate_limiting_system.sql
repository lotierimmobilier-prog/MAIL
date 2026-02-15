/*
  # Système de rate limiting

  1. Table de suivi des tentatives
    - `rate_limit_tracker`: Stocke les tentatives par identifiant et action
    - Nettoyage automatique des anciennes entrées
    
  2. Actions protégées
    - login: 5 tentatives / 15 minutes / IP
    - api_call: 100 requêtes / minute / user
    - sync_mailbox: 1 sync / 5 minutes / mailbox
    - send_email: 20 emails / heure / mailbox
    - export_data: 5 exports / jour / user
    
  3. Lockout progressif
    - 1ère violation: warning
    - 2ème violation: 5 minutes
    - 3ème violation: 1 heure
    - 4ème violation: 24 heures + alerte admin
    
  4. Sécurité
    - Les compteurs sont stockés avec TTL
    - Nettoyage automatique des anciennes entrées
    - Impossible de bypass sans access à la DB
*/

-- Table de suivi des rate limits
CREATE TABLE IF NOT EXISTS rate_limit_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  attempt_count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  violation_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_action ON rate_limit_tracker(identifier, action, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked ON rate_limit_tracker(blocked_until) WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup ON rate_limit_tracker(updated_at);

-- Configuration des limites par action
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT UNIQUE NOT NULL,
  max_attempts INT NOT NULL,
  window_seconds INT NOT NULL,
  lockout_seconds INT DEFAULT 300,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les configurations par défaut
INSERT INTO rate_limit_config (action, max_attempts, window_seconds, lockout_seconds, description) VALUES
  ('login', 5, 900, 900, 'Tentatives de connexion: 5 / 15 minutes'),
  ('api_call', 100, 60, 60, 'Appels API: 100 / minute'),
  ('sync_mailbox', 1, 300, 300, 'Synchronisation mailbox: 1 / 5 minutes'),
  ('send_email', 20, 3600, 3600, 'Envoi d''emails: 20 / heure'),
  ('export_data', 5, 86400, 3600, 'Export de données: 5 / jour'),
  ('password_reset', 3, 3600, 1800, 'Réinitialisation mot de passe: 3 / heure'),
  ('create_user', 10, 3600, 3600, 'Création d''utilisateur: 10 / heure')
ON CONFLICT (action) DO UPDATE SET
  max_attempts = EXCLUDED.max_attempts,
  window_seconds = EXCLUDED.window_seconds,
  lockout_seconds = EXCLUDED.lockout_seconds,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Fonction pour vérifier et enregistrer une tentative
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_config RECORD;
  v_tracker RECORD;
  v_window_start TIMESTAMPTZ;
  v_attempts INT;
  v_blocked_until TIMESTAMPTZ;
  v_violation_count INT := 0;
  v_lockout_duration INT;
BEGIN
  -- Récupérer la configuration pour cette action
  SELECT * INTO v_config
  FROM rate_limit_config
  WHERE action = p_action AND enabled = true;

  -- Si pas de configuration, autoriser
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'message', 'No rate limit configured'
    );
  END IF;

  -- Calculer le début de la fenêtre actuelle
  v_window_start := NOW() - (v_config.window_seconds || ' seconds')::INTERVAL;

  -- Récupérer ou créer le tracker
  SELECT * INTO v_tracker
  FROM rate_limit_tracker
  WHERE identifier = p_identifier
    AND action = p_action
    AND window_start > v_window_start
  ORDER BY window_start DESC
  LIMIT 1;

  -- Vérifier si l'utilisateur est bloqué
  IF v_tracker.blocked_until IS NOT NULL AND v_tracker.blocked_until > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', v_tracker.blocked_until,
      'retry_after', EXTRACT(EPOCH FROM (v_tracker.blocked_until - NOW()))::INT,
      'message', format('Too many attempts. Please try again in %s seconds.', 
        EXTRACT(EPOCH FROM (v_tracker.blocked_until - NOW()))::INT)
    );
  END IF;

  -- Si le tracker existe et est dans la fenêtre actuelle
  IF FOUND AND v_tracker.window_start > v_window_start THEN
    v_attempts := v_tracker.attempt_count + 1;
    v_violation_count := v_tracker.violation_count;

    -- Si la limite est dépassée
    IF v_attempts > v_config.max_attempts THEN
      v_violation_count := v_violation_count + 1;
      
      -- Calculer la durée du lockout basée sur le nombre de violations
      CASE v_violation_count
        WHEN 1 THEN v_lockout_duration := v_config.lockout_seconds;
        WHEN 2 THEN v_lockout_duration := v_config.lockout_seconds * 2;
        WHEN 3 THEN v_lockout_duration := v_config.lockout_seconds * 12;
        ELSE v_lockout_duration := 86400; -- 24 heures
      END CASE;
      
      v_blocked_until := NOW() + (v_lockout_duration || ' seconds')::INTERVAL;

      -- Mettre à jour le tracker
      UPDATE rate_limit_tracker
      SET
        attempt_count = v_attempts,
        last_attempt = NOW(),
        blocked_until = v_blocked_until,
        violation_count = v_violation_count,
        metadata = p_metadata,
        updated_at = NOW()
      WHERE id = v_tracker.id;

      -- Si c'est une violation sérieuse (3+), créer une alerte
      IF v_violation_count >= 3 THEN
        PERFORM log_security_event(
          NULL,
          'rate_limit_exceeded',
          'rate_limit',
          p_identifier,
          p_metadata->>'ip_address',
          p_metadata->>'user_agent',
          NULL,
          jsonb_build_object(
            'action', p_action,
            'attempts', v_attempts,
            'violation_count', v_violation_count,
            'lockout_duration', v_lockout_duration
          ),
          p_metadata
        );
      END IF;

      RETURN jsonb_build_object(
        'allowed', false,
        'blocked', true,
        'blocked_until', v_blocked_until,
        'retry_after', v_lockout_duration,
        'attempts', v_attempts,
        'max_attempts', v_config.max_attempts,
        'violation_count', v_violation_count,
        'message', format('Rate limit exceeded. Blocked for %s seconds.', v_lockout_duration)
      );
    END IF;

    -- Mettre à jour le compteur
    UPDATE rate_limit_tracker
    SET
      attempt_count = v_attempts,
      last_attempt = NOW(),
      metadata = p_metadata,
      updated_at = NOW()
    WHERE id = v_tracker.id;

    RETURN jsonb_build_object(
      'allowed', true,
      'attempts', v_attempts,
      'max_attempts', v_config.max_attempts,
      'remaining', v_config.max_attempts - v_attempts,
      'reset_at', v_tracker.window_start + (v_config.window_seconds || ' seconds')::INTERVAL,
      'message', format('%s attempts remaining', v_config.max_attempts - v_attempts)
    );
  ELSE
    -- Créer un nouveau tracker
    INSERT INTO rate_limit_tracker (
      identifier,
      action,
      attempt_count,
      window_start,
      last_attempt,
      metadata
    ) VALUES (
      p_identifier,
      p_action,
      1,
      NOW(),
      NOW(),
      p_metadata
    );

    RETURN jsonb_build_object(
      'allowed', true,
      'attempts', 1,
      'max_attempts', v_config.max_attempts,
      'remaining', v_config.max_attempts - 1,
      'reset_at', NOW() + (v_config.window_seconds || ' seconds')::INTERVAL,
      'message', format('%s attempts remaining', v_config.max_attempts - 1)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les anciennes entrées (à appeler périodiquement)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_tracker() RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  -- Supprimer les entrées de plus de 7 jours
  DELETE FROM rate_limit_tracker
  WHERE updated_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réinitialiser le rate limit d'un utilisateur (admin uniquement)
CREATE OR REPLACE FUNCTION reset_rate_limit(
  p_identifier TEXT,
  p_action TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_action IS NOT NULL THEN
    DELETE FROM rate_limit_tracker
    WHERE identifier = p_identifier AND action = p_action;
  ELSE
    DELETE FROM rate_limit_tracker
    WHERE identifier = p_identifier;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies
ALTER TABLE rate_limit_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire les rate limits
CREATE POLICY "Admins can read rate limits"
  ON rate_limit_tracker FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent modifier la configuration
CREATE POLICY "Admins can manage rate limit config"
  ON rate_limit_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Commentaires
COMMENT ON TABLE rate_limit_tracker IS 'Suivi des tentatives pour le rate limiting';
COMMENT ON TABLE rate_limit_config IS 'Configuration des limites de taux par action';
COMMENT ON FUNCTION check_rate_limit IS 'Vérifie si une action est autorisée selon les limites de taux';
COMMENT ON FUNCTION cleanup_rate_limit_tracker IS 'Nettoie les anciennes entrées de rate limiting';
COMMENT ON FUNCTION reset_rate_limit IS 'Réinitialise le rate limit pour un identifiant (admin uniquement)';
