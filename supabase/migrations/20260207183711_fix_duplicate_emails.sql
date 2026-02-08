/*
  # Correction des emails en double

  1. Nettoyage
    - Supprime les emails en double en gardant le plus ancien
    - Conserve uniquement le premier email pour chaque message_id

  2. Contrainte
    - Ajoute une contrainte UNIQUE sur la colonne message_id
    - Empêche l'insertion de doublons à l'avenir

  3. Index
    - Optimise les recherches par message_id
*/

-- Nettoyer les doublons en gardant uniquement le plus ancien email (id le plus petit)
DELETE FROM emails
WHERE id IN (
  SELECT e1.id
  FROM emails e1
  INNER JOIN emails e2 ON e1.message_id = e2.message_id
  WHERE e1.id > e2.id
);

-- Créer un index unique sur message_id pour empêcher les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id_unique ON emails(message_id);

-- Ajouter un commentaire pour documenter l'index
COMMENT ON INDEX idx_emails_message_id_unique IS 'Garantit l''unicité des message_id pour éviter les doublons';
