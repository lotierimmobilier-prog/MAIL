/*
  # Élimination des emails en double et ajout de contrainte unique

  ## Changements
  
  1. **Suppression des emails en double**
     - Identifie tous les emails ayant le même `message_id`
     - Conserve uniquement l'email le plus récent (created_at DESC)
     - Supprime les autres doublons
  
  2. **Ajout de contrainte unique**
     - Ajoute une contrainte UNIQUE sur `message_id` dans la table `emails`
     - Empêche l'insertion future d'emails en double
  
  ## Notes importantes
  - Les emails sans message_id (NULL) ne sont pas concernés par la contrainte
  - La contrainte s'applique uniquement aux message_id non-NULL
  - Les suppressions de doublons se font en cascade sur les tables liées
*/

-- Étape 1: Supprimer les emails en double en gardant le plus récent
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  -- Supprimer les emails en double (garder le plus récent par message_id)
  DELETE FROM emails
  WHERE id IN (
    SELECT e.id
    FROM emails e
    INNER JOIN (
      SELECT message_id, MAX(created_at) as max_created_at
      FROM emails
      WHERE message_id IS NOT NULL AND message_id != ''
      GROUP BY message_id
      HAVING COUNT(*) > 1
    ) dups ON e.message_id = dups.message_id
    WHERE e.created_at < dups.max_created_at
  );
  
  GET DIAGNOSTICS duplicate_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % emails en double', duplicate_count;
END $$;

-- Étape 2: Ajouter une contrainte UNIQUE sur message_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'emails_message_id_unique'
  ) THEN
    ALTER TABLE emails 
    ADD CONSTRAINT emails_message_id_unique 
    UNIQUE (message_id);
    
    RAISE NOTICE 'Contrainte UNIQUE ajoutée sur emails.message_id';
  END IF;
END $$;