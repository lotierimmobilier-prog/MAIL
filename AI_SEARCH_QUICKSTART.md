# Guide de démarrage rapide - Recherche IA

**⏱️ Temps estimé** : 10 minutes
**🎯 Objectif** : Activer et utiliser la recherche IA sémantique

---

## ✅ Prérequis

- ✓ Application déployée et fonctionnelle
- ✓ Emails déjà présents dans le système (optionnel pour le test)
- ✓ Compte OpenAI avec clé API

---

## 🚀 Étape 1 : Configuration OpenAI (5 min)

### 1.1 Obtenir une clé API OpenAI

1. Allez sur [platform.openai.com](https://platform.openai.com)
2. Créez un compte (ou connectez-vous)
3. Ajoutez un moyen de paiement (carte bancaire)
4. Allez dans **API Keys**
5. Cliquez sur **Create new secret key**
6. Donnez un nom : "EmailOps Production"
7. Copiez la clé (format: `sk-...`)

**⚠️ IMPORTANT** : Sauvegardez cette clé immédiatement, vous ne pourrez plus la voir.

### 1.2 Ajouter la clé dans Supabase

1. Allez sur le Dashboard Supabase de votre projet
2. **Settings** > **Edge Functions** > **Secrets**
3. Cliquez sur **Add new secret**
4. Nom : `OPENAI_API_KEY`
5. Valeur : Collez votre clé `sk-...`
6. Cliquez sur **Save**

✅ **Configuration terminée !**

---

## 📊 Étape 2 : Indexer les emails existants (3 min)

### 2.1 Accéder à l'interface admin

1. Connectez-vous à l'application
2. Menu latéral > **Admin**
3. Onglet **Recherche IA** (icône ✨)

### 2.2 Lancer l'indexation

1. Consultez les statistiques :
   - **Emails au total** : Nombre total d'emails
   - **En attente** : Emails à indexer

2. Cliquez sur **Générer les embeddings**

3. Attendez la fin (~1-2s par email)

4. **Si nécessaire** : Cliquez à nouveau pour traiter les 50 suivants

5. Répétez jusqu'à ce que "En attente" = 0

✅ **Indexation terminée !**

**Note** : Les nouveaux emails seront indexés automatiquement à la réception.

---

## 🔍 Étape 3 : Première recherche (2 min)

### 3.1 Accéder à la recherche

1. Allez dans **Inbox**
2. En haut de la page, vous verrez la **barre de recherche IA** (icône ✨ violette)

### 3.2 Effectuer une recherche

1. Cliquez dans la barre de recherche
2. Tapez une requête en langage naturel :
   - "facture du mois dernier"
   - "mail de mon notaire"
   - "document avec pièce jointe de Dupont"
   - "conversation importante cette semaine"

3. Appuyez sur **Entrée** ou cliquez sur l'icône 🔍

4. Consultez les résultats avec score de pertinence

5. Cliquez sur un résultat pour ouvrir l'email

✅ **Première recherche réussie !**

---

## 📝 Étape 4 : Résumer un email (1 min)

### 4.1 Ouvrir un email

1. Depuis l'Inbox, cliquez sur n'importe quel ticket

### 4.2 Générer un résumé

1. Sous la conversation, vous verrez un encadré violet :
   **"Résumer cet email avec l'IA"**

2. Cliquez dessus

3. Attendez 2-3 secondes

4. Consultez le résumé généré :
   - **Résumé** : 2-3 phrases
   - **Points clés** : Liste à puces
   - **Actions à faire** : Liste d'actions

✅ **Résumé généré avec succès !**

**Note** : Le résumé est mis en cache. Les prochains affichages seront instantanés.

---

## 🎉 Félicitations !

Vous avez activé et utilisé toutes les fonctionnalités de recherche IA :

- ✅ Configuration OpenAI
- ✅ Indexation des emails
- ✅ Recherche sémantique
- ✅ Résumés automatiques

---

## 🧪 Pour aller plus loin

### Tester différents types de requêtes

**Recherche par type de document** :
- "facture"
- "devis"
- "contrat"
- "attestation"

**Recherche par expéditeur** :
- "mail de Dupont"
- "email EDF"
- "message du notaire"

**Recherche par date** :
- "mail d'hier"
- "cette semaine"
- "mois dernier"
- "année dernière"

**Recherche par contenu** :
- "chauffage en panne"
- "problème de livraison"
- "demande de remboursement"

**Recherche combinée** :
- "facture EDF janvier"
- "mail important du notaire cette semaine"
- "dernier mail avec pièce jointe de Dupont"

---

## 💡 Conseils d'utilisation

### Pour de meilleurs résultats

✅ **Utilisez un langage naturel** - Écrivez comme vous parleriez
✅ **Soyez spécifique** - Ajoutez des détails (dates, noms, types)
✅ **Variez les formulations** - L'IA comprend les synonymes
✅ **Testez et ajustez** - Affinez votre requête si nécessaire

❌ **Évitez** :
- Mots-clés isolés sans contexte ("mail", "document")
- Requêtes trop vagues ("cherche truc")
- Orthographe trop approximative

---

## 🔧 Dépannage rapide

### Aucun résultat ?

1. Vérifiez que les emails sont indexés (Admin > Recherche IA)
2. Essayez une requête plus générale
3. Vérifiez que vous avez des emails correspondants

### Recherche lente ?

1. Actualisez la page
2. Vérifiez votre connexion internet
3. Consultez le Dashboard Supabase pour voir les logs

### Résumés non générés ?

1. Vérifiez la clé OpenAI dans Supabase Secrets
2. Consultez votre quota OpenAI : [platform.openai.com/usage](https://platform.openai.com/usage)
3. Vérifiez que l'email a du contenu (>50 caractères)

---

## 📊 Coûts estimés

### OpenAI API

| Usage | Coût mensuel estimé |
|-------|---------------------|
| **Petit** (1000 emails/mois, 500 recherches) | ~0.50 - 1$ |
| **Moyen** (5000 emails/mois, 2000 recherches) | ~2 - 5$ |
| **Gros** (20000 emails/mois, 10000 recherches) | ~10 - 20$ |

**Note** : Les résumés et embeddings sont mis en cache, donc pas de recoût.

---

## 📚 Documentation complète

Pour en savoir plus, consultez :
- **[AI_SEARCH_DOCUMENTATION.md](./AI_SEARCH_DOCUMENTATION.md)** - Documentation technique complète

---

## ✉️ Support

Besoin d'aide ?
1. Consultez la documentation complète
2. Vérifiez les logs Supabase
3. Contactez l'équipe technique

---

**Dernière mise à jour** : 15 février 2026
**Version** : 3.0.0
**Temps de lecture** : 5 minutes
