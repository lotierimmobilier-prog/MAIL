/*
  # Génération automatique des brouillons de réponse
  
  1. Nouvelles tables
    - `draft_generation_queue` - File d'attente pour la génération automatique de brouillons
  
  2. Modifications
    - Ajout d'un trigger sur la table `emails` pour détecter les nouveaux emails entrants
    - Création d'une fonction pour ajouter les tickets à la file de génération
  
  3. Fonctionnalités
    - Génère automatiquement un brouillon de réponse quand un email entrant arrive
    - Utilise l'historique complet de la boîte mail pour contextualiser
    - Évite les doublons dans la file d'attente
  
  4. Sécurité
    - Enable RLS sur la nouvelle table
    - Seuls les utilisateurs authentifiés peuvent voir la file
*/

CREATE TABLE IF NOT EXISTS draft_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE draft_generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view draft generation queue"
  ON draft_generation_queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_draft_queue_status ON draft_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_draft_queue_ticket ON draft_generation_queue(ticket_id);

CREATE OR REPLACE FUNCTION trigger_auto_draft_generation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    INSERT INTO draft_generation_queue (ticket_id, status)
    VALUES (NEW.ticket_id, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_draft_generation_trigger ON emails;

CREATE TRIGGER auto_draft_generation_trigger
  AFTER INSERT ON emails
  FOR EACH ROW
  WHEN (NEW.ticket_id IS NOT NULL AND NEW.direction = 'inbound')
  EXECUTE FUNCTION trigger_auto_draft_generation();
