# Guide de Classification IA - Automatique

## Fonctionnalités

Le système de classification automatique par IA classifie **automatiquement** tous les emails entrants sans aucune action requise de votre part.

## Comment Ça Fonctionne

### Classification Automatique Complète

**Lorsqu'un email arrive :**

1. **Email synchronisé** → L'email est récupéré de votre boîte mail
2. **Trigger SQL** → Ajout automatique dans la queue de classification
3. **Worker IA** → Traitement en arrière-plan (toutes les 30 secondes)
4. **Classification** → Analyse du sujet, contenu et expéditeur
5. **Suggestion affichée** → Badge visible instantanément dans l'interface
6. **Mise à jour temps réel** → Via WebSocket, sans rafraîchir la page

**✨ Tout est automatique, vous n'avez rien à faire !**

### 1. Suggestions de Catégories

Lorsqu'un ticket **n'a pas de catégorie assignée**, le système affiche automatiquement une suggestion de l'IA si :

- Une classification IA existe pour ce ticket
- Le niveau de confiance est **≥ 60%**

**Affichage :**
- Un badge avec un émoji robot 🤖
- Le nom de la catégorie suggérée
- Une bordure en pointillés violets
- Au survol : le niveau de confiance exact

**Exemple :**
```
🤖 Demande generale (85% confiance)
```

### 2. Application Instantanée

**Cliquez sur le badge de suggestion** pour :
- Appliquer automatiquement la catégorie suggérée
- Appliquer la priorité suggérée par l'IA
- Mettre à jour le ticket immédiatement

**Actions automatiques :**
1. Recherche de la catégorie correspondante dans votre système
2. Application de la catégorie au ticket
3. Application de la priorité suggérée
4. Rafraîchissement de l'affichage

### 3. Traitement en Arrière-Plan

Le système utilise une **queue de traitement** pour classifier les emails :

**Architecture :**
- **Queue SQL** : `classification_queue` stocke les emails à traiter
- **Worker** : Traite la queue toutes les 30 secondes
- **Déclencheurs SQL** : Ajoutent automatiquement les nouveaux emails
- **WebSocket** : Mise à jour en temps réel de l'interface

**Flux de traitement :**
```
Sync emails → Trigger SQL → Queue → Worker → Classification → WebSocket → Interface
```

**Avantages :**
- Aucune action manuelle requise
- Traitement asynchrone (n'impacte pas les performances)
- Retry automatique en cas d'échec (3 tentatives)
- Mise à jour en temps réel

## Interface Utilisateur

### Barre d'Outils de la Boîte de Réception

```
┌─────────────────────────────────────────────────────────┐
│  Nouveau message  │  Synchroniser  │  Actualiser        │
└─────────────────────────────────────────────────────────┘
```

**Boutons disponibles :**

| Bouton | Icône | Couleur | Action |
|--------|-------|---------|---------|
| Nouveau message | ✏️ | Vert | Composer un email |
| Synchroniser | 📥 | Cyan | Synchroniser les emails (déclenche la classification) |
| Actualiser | 🔄 | Gris | Recharger la liste |

**Note :** Aucun bouton "IA Classifier" - tout est automatique !

### Liste des Tickets

Pour chaque ticket **sans catégorie**, vous verrez :

```
┌──────────────────────────────────────────────────┐
│ ☐ Sujet du ticket                                │
│   Contact | Boîte mail | Assigné                 │
│                    🤖 Demande generale  ⚡ Moyen │
└──────────────────────────────────────────────────┘
```

**Cliquez sur le badge 🤖** pour appliquer la suggestion instantanément.

## Workflow Automatique

### Scénario 1 : Nouveaux Emails Entrants

**Vous :**
1. Cliquez sur **"Synchroniser"** (ou laissez la sync automatique)

**Le système (automatiquement) :**
1. Récupère les nouveaux emails
2. Les ajoute dans la queue de classification
3. Lance le worker en arrière-plan
4. Classifie chaque email (sujet + contenu + expéditeur)
5. Affiche les suggestions en temps réel

**Vous :**
1. Voyez les badges 🤖 apparaître automatiquement
2. Cliquez pour appliquer la suggestion si elle vous convient
3. Ou ignorez-la et classifiez manuellement

**⏱️ Temps total : ~30 secondes après la sync**

### Scénario 2 : Pendant que vous travaillez

**Le système travaille en arrière-plan :**
- Vérifie la queue toutes les 30 secondes
- Traite automatiquement les emails en attente
- Met à jour l'interface en temps réel via WebSocket
- Aucune action manuelle requise

**Vous :**
- Continuez votre travail normalement
- Les suggestions apparaissent automatiquement
- Appliquez-les en un clic quand vous les voyez

### Scénario 3 : Validation des Suggestions

**Badge 🤖 avec confiance élevée (≥ 80%) :**
1. Cliquez directement pour appliquer
2. La catégorie et priorité sont assignées automatiquement

**Badge 🤖 avec confiance moyenne (60-79%) :**
1. Survolez pour voir les détails
2. Vérifiez la pertinence
3. Cliquez pour appliquer ou ignorez

**Pas de badge :**
- Confiance < 60% ou aucune catégorie pertinente
- Classifiez manuellement si nécessaire

## Critères de Classification

### Analyse de l'IA

L'IA analyse pour chaque email :

**1. Contenu Textuel**
- Sujet de l'email
- Corps du message (jusqu'à 3000 caractères)
- Mots-clés définis pour chaque catégorie

**2. Métadonnées**
- Expéditeur (nom et email)
- Contexte de la conversation
- Historique du ticket

**3. Catégories Disponibles**
- Toutes vos catégories existantes
- Leurs descriptions
- Leurs mots-clés associés

### Niveau de Confiance

| Niveau | % | Action Recommandée |
|--------|---|-------------------|
| **Élevé** | 80-100% | Application automatique |
| **Bon** | 60-79% | Vérification recommandée |
| **Faible** | < 60% | Non affiché (nécessite révision manuelle) |

**Note :** Les suggestions avec une confiance < 60% ne sont **pas affichées** pour éviter les classifications erronées.

## Données Stockées

### Table : `ai_classifications`

Pour chaque classification, le système stocke :

```typescript
{
  ticket_id: string;           // ID du ticket
  category: string;            // Catégorie suggérée
  subcategory: string;         // Sous-catégorie
  priority: string;            // Priorité suggérée (low, medium, high, urgent)
  intent: string;              // Intention de l'expéditeur
  sentiment: string;           // Sentiment (positive, neutral, negative)
  confidence: number;          // Niveau de confiance (0-1)
  entities: object;            // Entités extraites (nom, email, téléphone, etc.)
  recommended_actions: array;  // Actions suggérées
  suggested_assignee: string;  // Assigné suggéré
}
```

**Persistance :**
- Les classifications sont sauvegardées en base de données
- Elles persistent même après rafraîchissement
- Elles sont réutilisées pour les suggestions futures

## Avantages

### Gain de Temps

**Avant :**
1. Ouvrir chaque ticket
2. Lire le contenu
3. Déterminer la catégorie
4. Assigner manuellement
5. Répéter pour chaque ticket

⏱️ **~2 minutes par ticket**

**Après :**
1. Cliquer sur "IA Classifier"
2. Vérifier les suggestions
3. Cliquer pour appliquer

⏱️ **~5 secondes par ticket**

**Économie : ~95% de temps** sur la classification !

### Cohérence

- Classification basée sur des critères objectifs
- Utilisation des mots-clés définis
- Réduction des erreurs humaines
- Standardisation du processus

### Intelligence

- Apprentissage continu des patterns
- Extraction d'entités (noms, emails, etc.)
- Analyse du sentiment
- Suggestions d'actions contextuelles

## Limites et Considérations

### Cas Non Couverts

L'IA peut avoir des difficultés avec :

1. **Emails ambigus** : Contenu trop vague ou multiple sujets
2. **Nouvelles catégories** : Catégories récemment ajoutées sans mots-clés
3. **Langues étrangères** : Emails dans des langues non françaises
4. **Emails très courts** : Manque de contexte pour classifier

**Solution :** Classification manuelle pour ces cas

### Vérification Recommandée

Vérifiez manuellement si :

- Confiance < 80%
- Sujet sensible ou critique
- Client VIP ou prioritaire
- Première interaction avec un client

### Dépendance OpenAI

**Note :** La classification IA nécessite une clé API OpenAI active.

**Sans clé API :**
- Fallback automatique sur classification par mots-clés
- Confiance fixée à 70%
- Catégorie par défaut : "Demande generale"

## Paramétrage des Catégories

### Optimiser les Suggestions

Pour améliorer la précision de l'IA :

**1. Définissez des Mots-Clés Pertinents**
```
Catégorie : Location
Mots-clés : louer, location, bail, locataire, loyer, appartement à louer
```

**2. Ajoutez des Descriptions Claires**
```
Description : Demandes relatives à la location de propriétés,
              gestion des locataires, paiements de loyers
```

**3. Créez des Catégories Spécifiques**
```
✅ Bon : "Location - Nouvelle demande", "Location - Problème locataire"
❌ Vague : "Divers", "Autre", "Questions"
```

### Gestion dans Admin

1. Allez dans **Admin > Catégories**
2. Cliquez sur une catégorie pour l'éditer
3. Ajoutez des **mots-clés** (séparés par des virgules)
4. Rédigez une **description** précise
5. Sauvegardez

L'IA utilisera ces informations immédiatement pour les prochaines classifications.

## Dépannage

### Problème : Aucune Suggestion Affichée

**Causes possibles :**
- Le ticket a déjà une catégorie
- Aucune classification IA n'existe pour ce ticket
- Confiance < 60%
- Clé API OpenAI non configurée

**Solution :**
1. Cliquez sur "IA Classifier" pour lancer la classification
2. Vérifiez les logs dans la console (F12)
3. Attendez quelques secondes et actualisez

### Problème : Mauvaise Catégorie Suggérée

**Causes possibles :**
- Mots-clés mal définis
- Email ambigu ou multi-sujets
- Catégorie trop générale

**Solution :**
1. Ne cliquez pas sur la suggestion
2. Assignez la bonne catégorie manuellement
3. Mettez à jour les mots-clés de la catégorie
4. L'IA s'améliorera au fil du temps

### Problème : Classification en Masse Échoue

**Erreurs courantes :**
```
❌ "Erreur réseau" → Vérifiez votre connexion
❌ "OpenAI API error" → Vérifiez la clé API
❌ "Timeout" → Réduisez le nombre de tickets
```

**Solution :**
1. Utilisez les filtres pour réduire le nombre de tickets
2. Classifiez par lots de 10-20 tickets
3. Attendez entre chaque lot
4. Vérifiez la configuration OpenAI

## Exemples d'Utilisation

### Exemple 1 : Demande de Location

**Email reçu :**
```
Objet : Intéressé par l'appartement rue Victor Hugo
Corps : Bonjour, je souhaiterais louer votre appartement...
```

**Classification IA :**
- **Catégorie :** Location (92% confiance)
- **Priorité :** Moyen
- **Sentiment :** Positif
- **Actions suggérées :**
  1. Envoyer les détails de la propriété
  2. Proposer une visite
  3. Envoyer le dossier de candidature

### Exemple 2 : Problème Technique

**Email reçu :**
```
Objet : URGENT - Fuite d'eau dans l'appartement
Corps : Il y a une fuite importante, venez vite !
```

**Classification IA :**
- **Catégorie :** Maintenance (95% confiance)
- **Priorité :** Urgent
- **Sentiment :** Négatif
- **Actions suggérées :**
  1. Contacter le client immédiatement
  2. Envoyer un plombier en urgence
  3. Documenter le problème

### Exemple 3 : Question Générale

**Email reçu :**
```
Objet : Question
Corps : Bonjour, j'ai une question sur vos services.
```

**Classification IA :**
- **Catégorie :** Demande generale (68% confiance)
- **Priorité :** Moyen
- **Sentiment :** Neutre
- **Actions suggérées :**
  1. Demander plus de détails
  2. Envoyer la brochure des services
  3. Proposer un appel téléphonique

## Statistiques et Suivi

### Voir l'Historique

Pour consulter toutes les classifications IA :

```sql
SELECT
  t.subject,
  c.category,
  c.confidence,
  c.created_at
FROM ai_classifications c
JOIN tickets t ON t.id = c.ticket_id
ORDER BY c.created_at DESC;
```

### Indicateurs de Performance

Mesurez l'efficacité de l'IA :

**Taux d'acceptation :**
```
(Suggestions appliquées / Suggestions affichées) × 100
```

**Gain de temps :**
```
Temps moyen avant : 2 min/ticket
Temps moyen après : 5 sec/ticket
Gain : 115 sec × nombre de tickets
```

## Prochaines Améliorations

### Fonctionnalités Futures

1. **Classification automatique au sync**
   - Classification dès la réception des emails
   - Pas besoin de cliquer sur "IA Classifier"

2. **Apprentissage des corrections**
   - L'IA apprend quand vous changez une catégorie
   - Amélioration continue de la précision

3. **Règles personnalisées**
   - Définir des règles de classification custom
   - Combinaison IA + règles métier

4. **Dashboard IA**
   - Statistiques de classification
   - Tendances des catégories
   - Rapports de performance

## Résumé

### Points Clés

✅ **Classification 100% automatique** - aucune action requise
✅ **Traitement en arrière-plan** - toutes les 30 secondes
✅ **Mise à jour temps réel** - via WebSocket
✅ **Suggestions intelligentes** - analysant sujet, contenu et expéditeur
✅ **Application en un clic** des suggestions
✅ **Niveau de confiance** affiché (seuil 60%)
✅ **Gain de temps** considérable (95%)
✅ **Cohérence** et standardisation
✅ **Retry automatique** en cas d'échec (3 tentatives)
✅ **Zéro configuration** - tout fonctionne dès la sync

### Commencer

1. **Configurez vos catégories** avec des mots-clés pertinents
2. **Synchronisez vos emails** (bouton "Synchroniser")
3. **Le système classifie automatiquement** en arrière-plan
4. **Attendez ~30 secondes** pour voir les suggestions
5. **Les badges 🤖 apparaissent** automatiquement
6. **Cliquez pour appliquer** ou ignorez

**C'est tout ! Le système travaille pour vous automatiquement.**

### Architecture Technique

**Composants :**
- **Trigger SQL** : `enqueue_new_ticket_for_classification()` et `enqueue_email_for_classification()`
- **Table Queue** : `classification_queue` avec statuts (pending, processing, completed, failed)
- **Worker** : `process-classification-queue` (appelé toutes les 30s)
- **Classificateur** : `classify-email` (utilise GPT-4 ou fallback mots-clés)
- **WebSocket** : Mise à jour temps réel via Supabase Realtime

**Sécurité :**
- Row Level Security (RLS) sur toutes les tables
- Service role uniquement pour les opérations sensibles
- Retry automatique (max 3 tentatives)
- Gestion des erreurs robuste

**Performance :**
- Traitement par batch (10 emails max par cycle)
- Non-bloquant (arrière-plan)
- Index optimisés sur la queue
- Cache des classifications

**Profitez de la puissance de l'IA qui travaille automatiquement pour vous !**
