/*
  # Correction des fonctions restantes avec search_path mutable

  Correction des fonctions de sécurité et rate limiting pour avoir un search_path fixe.
*/

-- Drop et recréer les fonctions avec search_path fixe

CREATE OR REPLACE FUNCTION calculate_risk_score(
  p_user_id UUID,
  p_action TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_risk_score INT := 0;
  v_failed_logins INT;
  v_unusual_ip BOOLEAN;
BEGIN
  IF p_action IN ('credential_accessed', 'credential_decrypted', 'data_exported', 'user_deleted', 'mailbox_deleted') THEN
    v_risk_score := v_risk_score + 30;
  END IF;

  IF p_action = 'login_failed' THEN
    v_risk_score := v_risk_score + 20;
    
    SELECT COUNT(*) INTO v_failed_logins
    FROM audit_log
    WHERE action = 'login_failed'
      AND (user_id = p_user_id OR ip_address = p_ip_address)
      AND created_at > NOW() - INTERVAL '15 minutes';
    
    IF v_failed_logins > 3 THEN
      v_risk_score := v_risk_score + (v_failed_logins - 3) * 10;
    END IF;
  END IF;

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

  IF EXTRACT(HOUR FROM NOW()) >= 23 OR EXTRACT(HOUR FROM NOW()) < 6 THEN
    v_risk_score := v_risk_score + 15;
  END IF;

  IF v_risk_score > 100 THEN
    v_risk_score := 100;
  END IF;

  RETURN v_risk_score;
END;
$$;

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
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_risk_score INT;
  v_audit_id UUID;
BEGIN
  v_risk_score := calculate_risk_score(p_user_id, p_action, p_ip_address, p_user_agent);

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

  IF v_risk_score >= 70 THEN
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
$$;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_config RECORD;
  v_tracker RECORD;
  v_window_start TIMESTAMPTZ;
  v_attempts INT;
  v_blocked_until TIMESTAMPTZ;
  v_violation_count INT := 0;
  v_lockout_duration INT;
BEGIN
  SELECT * INTO v_config
  FROM rate_limit_config
  WHERE action = p_action AND enabled = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'message', 'No rate limit configured'
    );
  END IF;

  v_window_start := NOW() - (v_config.window_seconds || ' seconds')::INTERVAL;

  SELECT * INTO v_tracker
  FROM rate_limit_tracker
  WHERE identifier = p_identifier
    AND action = p_action
    AND window_start > v_window_start
  ORDER BY window_start DESC
  LIMIT 1;

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

  IF FOUND AND v_tracker.window_start > v_window_start THEN
    v_attempts := v_tracker.attempt_count + 1;
    v_violation_count := v_tracker.violation_count;

    IF v_attempts > v_config.max_attempts THEN
      v_violation_count := v_violation_count + 1;
      
      CASE v_violation_count
        WHEN 1 THEN v_lockout_duration := v_config.lockout_seconds;
        WHEN 2 THEN v_lockout_duration := v_config.lockout_seconds * 2;
        WHEN 3 THEN v_lockout_duration := v_config.lockout_seconds * 12;
        ELSE v_lockout_duration := 86400;
      END CASE;
      
      v_blocked_until := NOW() + (v_lockout_duration || ' seconds')::INTERVAL;

      UPDATE rate_limit_tracker
      SET
        attempt_count = v_attempts,
        last_attempt = NOW(),
        blocked_until = v_blocked_until,
        violation_count = v_violation_count,
        metadata = p_metadata,
        updated_at = NOW()
      WHERE id = v_tracker.id;

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
$$;

CREATE OR REPLACE FUNCTION cleanup_rate_limit_tracker() RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM rate_limit_tracker
  WHERE updated_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION reset_rate_limit(
  p_identifier TEXT,
  p_action TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
$$;

-- Commentaires
COMMENT ON FUNCTION calculate_risk_score IS 'Calcule un score de risque (0-100) pour une action utilisateur. Utilise search_path fixe pour sécurité.';
COMMENT ON FUNCTION log_security_event IS 'Enregistre un événement de sécurité avec calcul automatique du risque. Utilise search_path fixe pour sécurité.';
COMMENT ON FUNCTION check_rate_limit IS 'Vérifie les limites de taux pour une action donnée. Utilise search_path fixe pour sécurité.';
COMMENT ON FUNCTION cleanup_rate_limit_tracker IS 'Nettoie les anciennes entrées de rate limiting. Utilise search_path fixe pour sécurité.';
COMMENT ON FUNCTION reset_rate_limit IS 'Réinitialise le rate limit pour un identifiant (admin uniquement). Utilise search_path fixe pour sécurité.';
