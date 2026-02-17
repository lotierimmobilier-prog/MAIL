/*
  # Trigger de classification automatique

  1. Fonction de trigger
    - `enqueue_new_ticket_for_classification()`
      - Ajoute automatiquement les nouveaux tickets dans la queue de classification
      - Déclenché après insertion d'un ticket
      - Ne classe que les tickets sans catégorie
      - Utilise le premier email du ticket pour la classification

  2. Triggers
    - `trigger_enqueue_ticket_classification`
      - Après INSERT sur tickets
      - Appelle enqueue_new_ticket_for_classification()

  3. Logique
    - Vérifie que le ticket n'a pas de category_id
    - Récupère le premier email du ticket
    - Insère dans classification_queue avec priority=1 (haute)
    - Évite les doublons grâce à l'index unique
*/

-- Fonction pour ajouter un ticket dans la queue de classification
CREATE OR REPLACE FUNCTION enqueue_new_ticket_for_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_email_id uuid;
BEGIN
  -- Seulement pour les tickets sans catégorie
  IF NEW.category_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer le premier email du ticket
  SELECT id INTO first_email_id
  FROM emails
  WHERE ticket_id = NEW.id
  ORDER BY received_at ASC
  LIMIT 1;

  -- Si un email existe, l'ajouter à la queue
  IF first_email_id IS NOT NULL THEN
    INSERT INTO classification_queue (
      email_id,
      ticket_id,
      status,
      priority
    )
    VALUES (
      first_email_id,
      NEW.id,
      'pending',
      1  -- Haute priorité pour les nouveaux tickets
    )
    ON CONFLICT (email_id) WHERE status IN ('pending', 'processing')
    DO NOTHING;  -- Ignorer si déjà en queue
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger après insertion d'un ticket
DROP TRIGGER IF EXISTS trigger_enqueue_ticket_classification ON tickets;
CREATE TRIGGER trigger_enqueue_ticket_classification
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_new_ticket_for_classification();

-- Trigger après insertion d'un email pour les tickets existants sans catégorie
CREATE OR REPLACE FUNCTION enqueue_email_for_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_category_id uuid;
BEGIN
  -- Vérifier si le ticket associé n'a pas de catégorie
  SELECT category_id INTO ticket_category_id
  FROM tickets
  WHERE id = NEW.ticket_id;

  -- Si le ticket n'a pas de catégorie, ajouter à la queue
  IF ticket_category_id IS NULL THEN
    INSERT INTO classification_queue (
      email_id,
      ticket_id,
      status,
      priority
    )
    VALUES (
      NEW.id,
      NEW.ticket_id,
      'pending',
      2  -- Priorité normale pour les emails ajoutés
    )
    ON CONFLICT (email_id) WHERE status IN ('pending', 'processing')
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_email_classification ON emails;
CREATE TRIGGER trigger_enqueue_email_classification
  AFTER INSERT ON emails
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_email_for_classification();
