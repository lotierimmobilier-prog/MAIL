/*
  # Créer la table drafts pour les brouillons AI

  1. Nouvelle Table
    - `drafts`
      - `id` (uuid, clé primaire)
      - `ticket_id` (uuid, référence vers tickets)
      - `subject` (text, sujet du brouillon)
      - `body` (text, corps HTML du brouillon)
      - `notes` (text, notes pour l'agent)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Active RLS sur la table `drafts`
    - Politique permettant aux utilisateurs authentifiés de lire leurs brouillons
    - Politique permettant aux edge functions de gérer les brouillons

  3. Index
    - Index sur `ticket_id` pour recherche rapide
*/

-- Créer la table drafts
CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer un index sur ticket_id pour les recherches
CREATE INDEX IF NOT EXISTS idx_drafts_ticket_id ON drafts(ticket_id);

-- Ajouter une contrainte unique pour un seul brouillon par ticket
CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_unique_ticket ON drafts(ticket_id);

-- Activer RLS
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- Politique: Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Utilisateurs authentifiés peuvent lire tous les brouillons"
  ON drafts
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique: Les edge functions (service_role) peuvent tout faire
CREATE POLICY "Service role peut gérer tous les brouillons"
  ON drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Politique: Suppression pour utilisateurs authentifiés
CREATE POLICY "Utilisateurs authentifiés peuvent supprimer les brouillons"
  ON drafts
  FOR DELETE
  TO authenticated
  USING (true);

-- Politique: Mise à jour pour utilisateurs authentifiés
CREATE POLICY "Utilisateurs authentifiés peuvent modifier les brouillons"
  ON drafts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
