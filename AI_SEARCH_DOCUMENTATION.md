# Documentation - Système de Recherche IA

**Version**: 3.0.0
**Date**: 15 février 2026
**Statut**: ✅ Production Ready

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Base de données](#base-de-données)
4. [Edge Functions](#edge-functions)
5. [Interface utilisateur](#interface-utilisateur)
6. [Utilisation](#utilisation)
7. [Configuration](#configuration)
8. [Sécurité](#sécurité)
9. [Performance](#performance)
10. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

Le système de recherche IA permet aux utilisateurs de rechercher des emails par **intention sémantique** et non plus uniquement par mots-clés exacts.

### Fonctionnalités principales

✅ **Recherche sémantique** - Comprend le sens, pas seulement les mots
✅ **Recherche hybride** - Combine full-text et vectoriel
✅ **Résumés IA** - Génère des résumés automatiques des emails
✅ **Suggestions intelligentes** - Historique de recherche personnalisé
✅ **Indexation automatique** - Nouveaux emails indexés automatiquement
✅ **Interface admin** - Gestion centralisée des embeddings

### Exemples de requêtes

| Requête utilisateur | Résultat |
|---------------------|----------|
| "facture EDF janvier" | Trouve les factures EDF même si le mot "facture" n'est pas dans l'email |
| "mail du notaire sur Capendu" | Comprend qu'on cherche un email d'un notaire concernant Capendu |
| "dernier mail avec pièce jointe de Dupont" | Filtre par expéditeur ET présence de pièce jointe |
| "compromis signé" | Trouve les emails contenant des compromis, même si le terme exact diffère |

---

## 🏗️ Architecture

### Stack technique

```
Frontend:
  - React + TypeScript
  - Tailwind CSS
  - Supabase JS Client

Backend:
  - Supabase PostgreSQL + pgvector
  - Edge Functions (Deno)
  - OpenAI API (embeddings + GPT-4o-mini)

AI:
  - text-embedding-3-small (1536 dimensions)
  - gpt-4o-mini (query understanding + summarization)
```

### Flux de données

```
[Email reçu]
     ↓
[Génération embedding] ← OpenAI API
     ↓
[Stockage vector DB] ← pgvector
     ↓
[Recherche utilisateur]
     ↓
[Query understanding] ← GPT-4o-mini
     ↓
[Génération embedding requête] ← OpenAI API
     ↓
[Recherche hybride] ← PostgreSQL
     ↓
[Résultats pertinents] → Frontend
```

---

## 💾 Base de données

### Tables créées

#### `email_embeddings`

Stocke les vecteurs d'embedding pour chaque email.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Clé primaire |
| `email_id` | uuid | Référence vers `emails` |
| `content` | text | Contenu indexé (sujet + corps + métadonnées) |
| `embedding` | vector(1536) | Vecteur sémantique OpenAI |
| `metadata` | jsonb | Métadonnées (expéditeur, date, etc.) |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de mise à jour |

**Index** :
- HNSW sur `embedding` pour recherche vectorielle rapide
- GIN sur `content` pour full-text search
- B-tree sur `email_id`

#### `search_history`

Historique des recherches pour suggestions intelligentes.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Clé primaire |
| `user_id` | uuid | Utilisateur ayant effectué la recherche |
| `query` | text | Requête de recherche |
| `results_count` | int | Nombre de résultats |
| `clicked_email_id` | uuid | Email cliqué (optionnel) |
| `created_at` | timestamptz | Date de recherche |

#### `email_summaries`

Résumés IA des emails (cache).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Clé primaire |
| `email_id` | uuid | Référence vers `emails` (unique) |
| `summary` | text | Résumé en 2-3 phrases |
| `key_points` | jsonb | Liste des points clés |
| `action_items` | jsonb | Liste des actions à faire |
| `created_at` | timestamptz | Date de génération |
| `updated_at` | timestamptz | Date de mise à jour |

### Fonctions PostgreSQL

#### `search_emails_semantic()`

Recherche sémantique pure basée sur la similarité vectorielle.

**Paramètres** :
- `query_embedding` : vector(1536) - Vecteur de la requête
- `match_threshold` : float - Seuil de similarité (défaut: 0.7)
- `match_count` : int - Nombre de résultats (défaut: 10)

**Retour** :
```sql
TABLE (
  email_id uuid,
  subject text,
  sender_email text,
  content_preview text,
  similarity float,
  created_at timestamptz
)
```

#### `search_emails_hybrid()`

Recherche hybride combinant full-text et vectoriel.

**Paramètres** :
- `query_text` : text - Texte de la requête
- `query_embedding` : vector(1536) - Vecteur de la requête
- `match_threshold` : float - Seuil combiné (défaut: 0.7)
- `match_count` : int - Nombre de résultats (défaut: 10)
- `user_id_filter` : uuid - Filtrage par utilisateur (optionnel)

**Score combiné** :
```
score = (similarity × 0.6) + (full_text_rank × 0.4)
```

**Retour** : Identique à `search_emails_semantic()`

---

## ⚡ Edge Functions

### 1. `generate-email-embedding`

Génère l'embedding pour un email spécifique.

**Endpoint** : `/functions/v1/generate-email-embedding`

**Request** :
```json
{
  "email_id": "uuid",
  "force": false
}
```

**Response** :
```json
{
  "success": true,
  "embedding_id": "uuid",
  "email_id": "uuid"
}
```

**Workflow** :
1. Vérifie si embedding existe déjà (sauf si `force: true`)
2. Récupère l'email et ses pièces jointes
3. Construit le contenu textuel complet
4. Appelle OpenAI API pour générer l'embedding
5. Sauvegarde en base

**Coût** : ~0.0001$ par email (text-embedding-3-small)

---

### 2. `semantic-search`

Effectue une recherche sémantique.

**Endpoint** : `/functions/v1/semantic-search`

**Request** :
```json
{
  "query": "facture EDF janvier",
  "threshold": 0.5,
  "limit": 10,
  "filters": {
    "sender": "edf",
    "date_from": "2026-01-01",
    "date_to": "2026-01-31",
    "has_attachments": true
  }
}
```

**Response** :
```json
{
  "success": true,
  "results": [
    {
      "email_id": "uuid",
      "subject": "Facture EDF - Janvier 2026",
      "sender_email": "contact@edf.fr",
      "content_preview": "Votre facture d'électricité...",
      "similarity": 0.89,
      "created_at": "2026-01-15T10:00:00Z"
    }
  ],
  "count": 1,
  "query": "facture EDF janvier"
}
```

**Workflow** :
1. Authentifie l'utilisateur
2. Génère l'embedding de la requête via OpenAI
3. Appelle `search_emails_semantic()` en base
4. Applique les filtres supplémentaires
5. Enregistre dans l'historique de recherche

**Coût** : ~0.0001$ par recherche

---

### 3. `understand-query`

Analyse et comprend la requête utilisateur.

**Endpoint** : `/functions/v1/understand-query`

**Request** :
```json
{
  "query": "facture EDF de janvier dernier"
}
```

**Response** :
```json
{
  "success": true,
  "query": "facture EDF de janvier dernier",
  "understanding": {
    "intent": "find_document",
    "type": "facture",
    "sender": "EDF",
    "date_range": {
      "from": "2026-01-01",
      "to": "2026-01-31"
    },
    "keywords": ["facture", "EDF", "janvier"],
    "suggested_filters": {
      "sender": "EDF",
      "date_from": "2026-01-01",
      "date_to": "2026-01-31"
    }
  }
}
```

**Workflow** :
1. Envoie la requête à GPT-4o-mini
2. Extrait les entités (expéditeur, date, type de document)
3. Génère des filtres suggérés
4. Retourne la compréhension structurée

**Coût** : ~0.0002$ par requête

**Note** : Cette fonction peut être utilisée pour améliorer la recherche en pré-filtrant avant la recherche vectorielle.

---

### 4. `summarize-email`

Génère un résumé IA d'un email.

**Endpoint** : `/functions/v1/summarize-email`

**Request** :
```json
{
  "email_id": "uuid",
  "force": false
}
```

**Response** :
```json
{
  "success": true,
  "summary": "Le notaire confirme la signature du compromis de vente pour la propriété de Capendu. Les documents sont joints en pièce jointe.",
  "key_points": [
    "Compromis de vente signé",
    "Propriété: Capendu",
    "Documents joints"
  ],
  "action_items": [
    "Vérifier les documents en pièce jointe",
    "Répondre au notaire sous 48h"
  ],
  "cached": false
}
```

**Workflow** :
1. Vérifie si résumé existe en cache (sauf si `force: true`)
2. Récupère le contenu de l'email
3. Envoie à GPT-4o-mini pour génération du résumé
4. Structure le résumé (résumé + points clés + actions)
5. Sauvegarde en cache

**Coût** : ~0.0005$ par email (selon longueur)

---

### 5. `batch-generate-embeddings`

Génère les embeddings par lots (indexation massive).

**Endpoint** : `/functions/v1/batch-generate-embeddings`

**Request** :
```json
{
  "limit": 50,
  "offset": 0
}
```

**Response** :
```json
{
  "success": true,
  "total_emails": 50,
  "processed": 48,
  "errors": 2,
  "error_details": ["Email abc: content too short"],
  "message": "Processed 48/50 emails successfully"
}
```

**Workflow** :
1. Récupère les emails sans embedding
2. Appelle `generate-email-embedding` pour chaque email
3. Agrège les résultats
4. Retourne le rapport

**Usage** : Interface admin pour indexer les emails existants.

---

## 🎨 Interface utilisateur

### 1. `AiSearchBar`

Barre de recherche intelligente avec suggestions.

**Localisation** : `src/components/search/AiSearchBar.tsx`

**Intégration** : Ajoutée dans `InboxView` en haut de page.

**Fonctionnalités** :
- Recherche en temps réel
- Suggestions basées sur l'historique
- Affichage des résultats avec score de pertinence
- Navigation vers l'email cliqué

**Props** :
```typescript
interface AiSearchBarProps {
  onResultClick?: (emailId: string) => void;
}
```

**Exemple d'utilisation** :
```tsx
<AiSearchBar onResultClick={(emailId) => navigate(`/inbox/${emailId}`)} />
```

---

### 2. `EmailSummary`

Composant de résumé IA d'un email.

**Localisation** : `src/components/search/EmailSummary.tsx`

**Intégration** : Ajouté dans `TicketDetailView` après `ConversationThread`.

**Fonctionnalités** :
- Génération à la demande
- Mise en cache automatique
- Affichage structuré (résumé + points clés + actions)
- Indicateur de cache

**Props** :
```typescript
interface EmailSummaryProps {
  emailId: string;
}
```

**Exemple d'utilisation** :
```tsx
<EmailSummary emailId={email.id} />
```

---

### 3. `AiSearchManager`

Interface admin de gestion des embeddings.

**Localisation** : `src/components/admin/AiSearchManager.tsx`

**Intégration** : Nouvel onglet "Recherche IA" dans `AdminView`.

**Fonctionnalités** :
- Statistiques en temps réel (total emails / indexés / en attente)
- Barre de progression d'indexation
- Génération par lots (50 emails à la fois)
- Historique des opérations

**Interface** :
- **Cartes statistiques** : Total, Indexés, En attente
- **Barre de progression** : Pourcentage d'indexation
- **Actions** : Bouton "Générer les embeddings"
- **Résultats** : Feedback en temps réel

---

## 📖 Utilisation

### Pour les utilisateurs finaux

#### 1. Rechercher un email

1. Allez dans **Inbox**
2. Utilisez la barre de recherche IA (icône ✨ violette)
3. Tapez votre requête en langage naturel
4. Sélectionnez un résultat

**Exemples de requêtes** :
- "facture janvier dernier"
- "mail du notaire"
- "dernière conversation avec Dupont"
- "document important cette semaine"

#### 2. Résumer un email

1. Ouvrez un ticket/email
2. Cliquez sur **"Résumer cet email avec l'IA"**
3. Consultez le résumé, les points clés et actions

---

### Pour les administrateurs

#### 1. Indexer les emails existants

1. Allez dans **Admin > Recherche IA**
2. Consultez les statistiques
3. Cliquez sur **"Générer les embeddings"**
4. Attendez la fin du traitement
5. Répétez si nécessaire (traitement par lots de 50)

#### 2. Suivre la progression

- **Emails au total** : Nombre total d'emails dans le système
- **Emails indexés** : Nombre d'emails avec embeddings
- **En attente** : Emails restant à indexer
- **Progression** : Barre de progression en pourcentage

---

## ⚙️ Configuration

### Variables d'environnement

**Frontend** (`.env`) :
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Backend** (Supabase Secrets - auto-configuré) :
```env
OPENAI_API_KEY=sk-... # Clé API OpenAI
SUPABASE_URL=https://... # Auto-configuré
SUPABASE_ANON_KEY=eyJh... # Auto-configuré
SUPABASE_SERVICE_ROLE_KEY=eyJh... # Auto-configuré
```

**⚠️ IMPORTANT** : La clé OpenAI API doit être configurée dans les secrets Supabase.

### Obtenir une clé OpenAI

1. Créez un compte sur [platform.openai.com](https://platform.openai.com)
2. Allez dans **API Keys**
3. Créez une nouvelle clé
4. Ajoutez-la aux secrets Supabase :
   - Dashboard Supabase
   - Settings > Edge Functions > Secrets
   - Ajoutez `OPENAI_API_KEY`

### Coûts estimés OpenAI

| Opération | Modèle | Coût unitaire | Exemple |
|-----------|--------|---------------|---------|
| Embedding | text-embedding-3-small | ~0.0001$ | 1000 emails = 0.10$ |
| Recherche | text-embedding-3-small | ~0.0001$ | 1000 recherches = 0.10$ |
| Query Understanding | gpt-4o-mini | ~0.0002$ | 1000 analyses = 0.20$ |
| Résumé | gpt-4o-mini | ~0.0005$ | 1000 résumés = 0.50$ |

**Estimation mensuelle** :
- Petit volume (1000 emails/mois) : ~1-2$ /mois
- Volume moyen (10000 emails/mois) : ~10-20$ /mois
- Gros volume (100000 emails/mois) : ~100-200$ /mois

---

## 🔐 Sécurité

### Row Level Security (RLS)

Toutes les tables ont RLS activé :

#### `email_embeddings`
- **SELECT** : Utilisateurs peuvent lire les embeddings des emails accessibles
- **INSERT/UPDATE** : Réservé aux systèmes authentifiés

#### `search_history`
- **SELECT** : Utilisateurs peuvent lire leur propre historique uniquement
- **INSERT** : Utilisateurs peuvent créer leur historique

#### `email_summaries`
- **SELECT** : Utilisateurs peuvent lire les résumés des emails accessibles
- **INSERT/UPDATE** : Réservé aux systèmes authentifiés

### Isolation des données

- Chaque recherche est limitée aux emails de l'utilisateur
- L'historique de recherche est isolé par utilisateur
- Les embeddings héritent des permissions des emails sources

### Protection des API Keys

- Clés OpenAI stockées en Supabase Secrets (chiffrées)
- Jamais exposées côté client
- Rotation régulière recommandée

---

## ⚡ Performance

### Optimisations base de données

#### Index HNSW

```sql
CREATE INDEX email_embeddings_vector_idx
  ON email_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Paramètres** :
- `m = 16` : Nombre de connexions par nœud
- `ef_construction = 64` : Précision de construction

**Performances** :
- Recherche sur 10k emails : ~50ms
- Recherche sur 100k emails : ~100ms
- Recherche sur 1M emails : ~200ms

#### Index Full-text

```sql
CREATE INDEX email_embeddings_content_idx
  ON email_embeddings
  USING gin(to_tsvector('french', content));
```

**Performances** :
- Recherche texte sur 10k emails : ~20ms
- Combinaison avec recherche vectorielle : ~70ms

### Cache

#### Résumés IA

Les résumés sont mis en cache dans `email_summaries` :
- Premier appel : ~2-3s (génération)
- Appels suivants : ~50ms (lecture cache)

#### Embeddings

Les embeddings sont pré-calculés et stockés :
- Pas de recalcul à chaque recherche
- Indexation async lors de la réception des emails

### Limites recommandées

| Métrique | Valeur | Justification |
|----------|--------|---------------|
| Résultats par recherche | 10-20 | UX optimale |
| Batch embedding | 50 | Évite timeout |
| Timeout edge functions | 60s | Génération résumés longs |
| Seuil similarité | 0.5-0.7 | Équilibre pertinence/rappel |

---

## 🐛 Dépannage

### Problème : Aucun résultat de recherche

**Causes possibles** :
1. Emails pas encore indexés
2. Seuil de similarité trop élevé
3. Requête trop vague

**Solutions** :
1. Vérifier l'indexation dans Admin > Recherche IA
2. Baisser le seuil à 0.4-0.5
3. Reformuler la requête avec plus de détails

---

### Problème : Recherche lente (>5s)

**Causes possibles** :
1. Index HNSW non créé
2. Trop de résultats demandés
3. Base trop volumineuse sans optimisation

**Solutions** :
1. Vérifier la présence des index :
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'email_embeddings';
   ```
2. Limiter à 10-20 résultats max
3. Augmenter `m` et `ef_construction` de l'index HNSW

---

### Problème : Résumés non générés

**Causes possibles** :
1. Clé OpenAI API non configurée
2. Quota OpenAI dépassé
3. Email trop court (<50 caractères)

**Solutions** :
1. Vérifier la configuration Supabase Secrets
2. Consulter l'usage OpenAI : [platform.openai.com/usage](https://platform.openai.com/usage)
3. Vérifier la longueur du contenu email

---

### Problème : Embeddings non générés en batch

**Causes possibles** :
1. Timeout edge function (>60s)
2. Erreur OpenAI API
3. Emails sans contenu

**Solutions** :
1. Réduire `limit` à 25-30 emails
2. Vérifier les logs Supabase Edge Functions
3. Consulter `error_details` dans la réponse

---

## 📊 Monitoring

### Métriques à surveiller

1. **Taux d'indexation** :
   ```sql
   SELECT
     COUNT(*) as total_emails,
     (SELECT COUNT(*) FROM email_embeddings) as indexed,
     COUNT(*) - (SELECT COUNT(*) FROM email_embeddings) as pending
   FROM emails;
   ```

2. **Recherches populaires** :
   ```sql
   SELECT query, COUNT(*) as count
   FROM search_history
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY query
   ORDER BY count DESC
   LIMIT 10;
   ```

3. **Performance recherche** :
   - Utiliser `EXPLAIN ANALYZE` sur les requêtes lentes
   - Monitorer temps de réponse Edge Functions

4. **Coûts OpenAI** :
   - Consulter régulièrement [platform.openai.com/usage](https://platform.openai.com/usage)
   - Alerte si dépassement budget

---

## 🚀 Roadmap

### Version 3.1 (Q2 2026)
- [ ] Recherche multi-langues (français + anglais)
- [ ] Filtres avancés dans l'UI
- [ ] Export des résultats de recherche
- [ ] Amélioration du scoring hybride

### Version 3.2 (Q3 2026)
- [ ] Classification automatique par IA lors de l'indexation
- [ ] Détection de doublons sémantiques
- [ ] Suggestions de tags automatiques
- [ ] Recherche par similarité visuelle (pièces jointes images)

### Version 4.0 (Q4 2026)
- [ ] Assistant conversationnel (chatbot)
- [ ] RAG (Retrieval Augmented Generation) pour réponses automatiques
- [ ] Analyse de sentiment des emails
- [ ] Prédiction de priorité

---

## 📚 Ressources

### Documentation externe

- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [pgvector](https://github.com/pgvector/pgvector)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [HNSW Index](https://github.com/nmslib/hnswlib)

### Support

Pour toute question ou problème :
1. Consultez d'abord cette documentation
2. Vérifiez les logs Supabase (Database > Logs / Edge Functions > Logs)
3. Contactez l'équipe technique

---

**Dernière mise à jour** : 15 février 2026
**Mainteneur** : Équipe Développement
**Version** : 3.0.0
