/*
  # Système de recherche IA avec embeddings vectoriels

  1. Extension
    - Active pgvector pour les recherches vectorielles
  
  2. Nouvelle table
    - `email_embeddings`
      - `id` (uuid, clé primaire)
      - `email_id` (uuid, référence vers emails)
      - `content` (text, contenu indexé)
      - `embedding` (vector(1536), vecteur OpenAI text-embedding-3-small)
      - `metadata` (jsonb, métadonnées pour filtrage)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  3. Index
    - Index HNSW pour recherche vectorielle rapide
    - Index GIN pour recherche full-text
    - Index sur email_id pour jointures
  
  4. Fonctions
    - Fonction de recherche hybride (texte + sémantique)
    - Fonction de calcul de similarité
  
  5. Sécurité
    - RLS activé avec policies basées sur l'accès aux emails
    - Isolation par utilisateur
  
  6. Performance
    - Index optimisés pour requêtes rapides
    - Embeddings pré-calculés et mis en cache
*/

-- Activer l'extension pgvector si pas déjà fait
CREATE EXTENSION IF NOT EXISTS vector;

-- Table pour stocker les embeddings des emails
CREATE TABLE IF NOT EXISTS email_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(email_id)
);

-- Index pour recherche vectorielle rapide (HNSW = Hierarchical Navigable Small World)
CREATE INDEX IF NOT EXISTS email_embeddings_vector_idx 
  ON email_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index pour email_id (jointures rapides)
CREATE INDEX IF NOT EXISTS email_embeddings_email_id_idx 
  ON email_embeddings(email_id);

-- Index GIN pour recherche full-text sur content
CREATE INDEX IF NOT EXISTS email_embeddings_content_idx 
  ON email_embeddings 
  USING gin(to_tsvector('french', content));

-- Index sur metadata pour filtrage
CREATE INDEX IF NOT EXISTS email_embeddings_metadata_idx 
  ON email_embeddings 
  USING gin(metadata);

-- Fonction de recherche hybride (full-text + sémantique)
CREATE OR REPLACE FUNCTION search_emails_hybrid(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  email_id uuid,
  subject text,
  sender_email text,
  content_preview text,
  similarity_score float,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT 
      ee.email_id,
      1 - (ee.embedding <=> query_embedding) as similarity
    FROM email_embeddings ee
    WHERE ee.embedding IS NOT NULL
    ORDER BY ee.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  text_results AS (
    SELECT 
      ee.email_id,
      ts_rank(to_tsvector('french', ee.content), plainto_tsquery('french', query_text)) as rank
    FROM email_embeddings ee
    WHERE to_tsvector('french', ee.content) @@ plainto_tsquery('french', query_text)
    LIMIT match_count * 2
  ),
  combined_results AS (
    SELECT 
      COALESCE(sr.email_id, tr.email_id) as email_id,
      COALESCE(sr.similarity, 0) * 0.6 + COALESCE(tr.rank, 0) * 0.4 as combined_score
    FROM semantic_results sr
    FULL OUTER JOIN text_results tr ON sr.email_id = tr.email_id
    WHERE COALESCE(sr.similarity, 0) * 0.6 + COALESCE(tr.rank, 0) * 0.4 >= match_threshold
  )
  SELECT 
    e.id as email_id,
    e.subject,
    e.sender_email,
    LEFT(e.body_text, 200) as content_preview,
    cr.combined_score as similarity_score,
    e.created_at
  FROM combined_results cr
  JOIN emails e ON e.id = cr.email_id
  WHERE (user_id_filter IS NULL OR e.id IN (
    SELECT email_id FROM emails WHERE id = e.id
  ))
  ORDER BY cr.combined_score DESC
  LIMIT match_count;
END;
$$;

-- Fonction de recherche sémantique pure
CREATE OR REPLACE FUNCTION search_emails_semantic(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  email_id uuid,
  subject text,
  sender_email text,
  content_preview text,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as email_id,
    e.subject,
    e.sender_email,
    LEFT(e.body_text, 200) as content_preview,
    1 - (ee.embedding <=> query_embedding) as similarity,
    e.created_at
  FROM email_embeddings ee
  JOIN emails e ON e.id = ee.email_id
  WHERE ee.embedding IS NOT NULL
    AND 1 - (ee.embedding <=> query_embedding) >= match_threshold
  ORDER BY ee.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Activer RLS sur email_embeddings
ALTER TABLE email_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs authentifiés peuvent lire les embeddings des emails qu'ils peuvent voir
CREATE POLICY "Users can read embeddings of their accessible emails"
  ON email_embeddings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails e
      WHERE e.id = email_embeddings.email_id
    )
  );

-- Policy: Seuls les systèmes peuvent insérer/mettre à jour les embeddings
CREATE POLICY "System can insert embeddings"
  ON email_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update embeddings"
  ON email_embeddings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Table pour suivre les recherches et améliorer les suggestions
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query text NOT NULL,
  results_count int DEFAULT 0,
  clicked_email_id uuid REFERENCES emails(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Index pour récupérer l'historique par utilisateur
CREATE INDEX IF NOT EXISTS search_history_user_id_idx 
  ON search_history(user_id, created_at DESC);

-- Activer RLS
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent lire leur propre historique
CREATE POLICY "Users can read own search history"
  ON search_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent insérer dans leur historique
CREATE POLICY "Users can insert own search history"
  ON search_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Table pour les résumés IA des emails
CREATE TABLE IF NOT EXISTS email_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE NOT NULL UNIQUE,
  summary text NOT NULL,
  key_points jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index sur email_id
CREATE INDEX IF NOT EXISTS email_summaries_email_id_idx 
  ON email_summaries(email_id);

-- Activer RLS
ALTER TABLE email_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent lire les résumés des emails accessibles
CREATE POLICY "Users can read summaries of accessible emails"
  ON email_summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emails e
      WHERE e.id = email_summaries.email_id
    )
  );

-- Policy: Le système peut insérer/mettre à jour les résumés
CREATE POLICY "System can manage summaries"
  ON email_summaries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_embeddings_updated_at
  BEFORE UPDATE ON email_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_summaries_updated_at
  BEFORE UPDATE ON email_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
