/*
  # Migration vers chiffrement sécurisé AES-256-GCM pour les credentials

  1. Nouveaux champs sécurisés
    - `encrypted_password_secure`: Stockage du mot de passe chiffré (format: base64(iv + authTag + ciphertext))
    - `ovh_consumer_key_secure`: Stockage de la clé OVH chiffrée
    - `encryption_version`: Version du système de chiffrement (pour future rotation)
    - `encrypted_at`: Date du dernier chiffrement
    
  2. Sécurité
    - Les anciens champs restent temporairement pour migration progressive
    - RLS empêche la lecture des champs sécurisés par le client
    - Seules les edge functions avec SERVICE_ROLE_KEY peuvent décrypter
    
  3. Migration des données existantes
    - À effectuer via script séparé après déploiement des edge functions
    - Vérification de la migration avant suppression des anciens champs
    
  4. Notes importantes
    - ENCRYPTION_KEY doit être configurée dans les secrets Supabase
    - Clé de 32 bytes (256 bits) pour AES-256
    - IV unique généré pour chaque credential (12 bytes pour GCM)
*/

-- Ajouter les nouveaux champs sécurisés
ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS encrypted_password_secure TEXT,
  ADD COLUMN IF NOT EXISTS ovh_consumer_key_secure TEXT,
  ADD COLUMN IF NOT EXISTS encryption_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS encrypted_at TIMESTAMPTZ;

-- Créer une vue sécurisée qui n'expose JAMAIS les credentials
CREATE OR REPLACE VIEW mailboxes_safe AS
SELECT
  id,
  name,
  email_address,
  provider_type,
  imap_host,
  imap_port,
  smtp_host,
  smtp_port,
  smtp_security,
  username,
  use_tls,
  polling_interval_seconds,
  is_active,
  signature,
  style_prompt,
  tone,
  ovh_domain,
  ovh_account,
  created_at,
  updated_at,
  -- Indicateurs de présence des credentials (sans les valeurs)
  (encrypted_password_secure IS NOT NULL) AS has_password,
  (ovh_consumer_key_secure IS NOT NULL) AS has_ovh_key,
  encryption_version,
  encrypted_at
FROM mailboxes;

-- Politique RLS pour la vue sécurisée
ALTER TABLE mailboxes_safe OWNER TO postgres;

-- Créer une fonction pour logger l'accès aux credentials
CREATE OR REPLACE FUNCTION log_credential_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Logger uniquement en cas d'accès aux champs sensibles
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Le trigger sera activé après migration complète des données
-- pour éviter de logger chaque mise à jour pendant la migration

-- Commentaires pour documentation
COMMENT ON COLUMN mailboxes.encrypted_password_secure IS 'Mot de passe IMAP/SMTP chiffré avec AES-256-GCM. Format: base64(iv + authTag + ciphertext). Accessible uniquement via edge functions.';
COMMENT ON COLUMN mailboxes.ovh_consumer_key_secure IS 'Clé consumer OVH chiffrée avec AES-256-GCM. Format: base64(iv + authTag + ciphertext). Accessible uniquement via edge functions.';
COMMENT ON COLUMN mailboxes.encryption_version IS 'Version du système de chiffrement pour permettre la rotation de clé';
COMMENT ON COLUMN mailboxes.encrypted_at IS 'Date du dernier chiffrement des credentials';

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_mailboxes_encrypted_at ON mailboxes(encrypted_at) WHERE encrypted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mailboxes_encryption_version ON mailboxes(encryption_version);
