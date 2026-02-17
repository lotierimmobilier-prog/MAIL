# Guide de Classification IA - Boîte de Réception

## Fonctionnalités Ajoutées

Le système de classification automatique par IA a été intégré directement dans la boîte de réception pour suggérer des catégories pour vos tickets.

## Comment Ça Fonctionne

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

### 3. Classification en Masse

Un nouveau bouton **"IA Classifier"** (avec icône ✨ Sparkles) permet de :

**Fonctionnement :**
1. Identifie tous les tickets visibles sans catégorie
2. Filtre ceux qui n'ont pas encore de classification IA
3. Lance la classification en masse
4. Affiche le nombre de tickets classifiés

**Utilisation :**
```
1. Cliquez sur "IA Classifier"
2. Confirmez le nombre de tickets à classifier
3. Attendez la classification (quelques secondes)
4. Consultez le résultat affiché
```

**Message de résultat :**
```
✅ 15 tickets classifiés par l'IA
```

## Interface Utilisateur

### Barre d'Outils de la Boîte de Réception

```
┌─────────────────────────────────────────────────────────┐
│  Nouveau message  │  IA Classifier  │  Synchroniser  │ ...│
└─────────────────────────────────────────────────────────┘
```

**Boutons disponibles :**

| Bouton | Icône | Couleur | Action |
|--------|-------|---------|---------|
| Nouveau message | ✏️ | Vert | Composer un email |
| **IA Classifier** | ✨ | **Violet** | **Classifier en masse** |
| Synchroniser | 📥 | Cyan | Synchroniser les emails |
| Actualiser | 🔄 | Gris | Recharger la liste |

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

## Workflow Recommandé

### Scénario 1 : Nouveau Ticket Non Classifié

1. **Synchronisez vos emails** → Bouton "Synchroniser"
2. **Les nouveaux tickets apparaissent** sans catégorie
3. **Lancez la classification IA** → Bouton "IA Classifier"
4. **Consultez les suggestions** (badges violets avec 🤖)
5. **Cliquez sur une suggestion** pour l'appliquer
6. **Ou modifiez manuellement** si nécessaire

### Scénario 2 : Traitement en Lot

1. **Filtrez vos tickets** (par boîte mail, statut, etc.)
2. **Cliquez sur "IA Classifier"**
3. **Confirmez** le nombre de tickets à classifier
4. **Attendez** le résultat (quelques secondes)
5. **Vérifiez** les catégories suggérées
6. **Appliquez** les suggestions pertinentes

### Scénario 3 : Validation Manuelle

1. **Un ticket a une suggestion** (badge 🤖)
2. **Survolez le badge** pour voir la confiance
3. **Si confiance ≥ 80%** → Cliquez pour appliquer
4. **Si confiance < 80%** → Ouvrez le ticket pour vérifier
5. **Appliquez ou modifiez** selon votre jugement

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

✅ **Suggestions automatiques** pour les tickets sans catégorie
✅ **Application en un clic** des suggestions
✅ **Classification en masse** avec le bouton "IA Classifier"
✅ **Niveau de confiance** affiché (seuil 60%)
✅ **Gain de temps** considérable (95%)
✅ **Cohérence** et standardisation
✅ **Facile à utiliser** - interface intuitive

### Commencer

1. **Configurez vos catégories** avec des mots-clés pertinents
2. **Synchronisez vos emails**
3. **Cliquez sur "IA Classifier"**
4. **Vérifiez les suggestions** (badges 🤖)
5. **Appliquez les suggestions** en un clic
6. **Ajustez si nécessaire**

**Profitez de la puissance de l'IA pour gérer votre boîte de réception plus efficacement !**
