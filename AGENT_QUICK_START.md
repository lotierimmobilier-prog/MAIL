# Guide Rapide - Accès des Agents aux Boîtes Mail

## Pour l'Administrateur

### Créer et Configurer un Agent en 3 Étapes

#### 1. Créer l'Agent
- **Admin** → **Utilisateurs** → **+ Créer Utilisateur**
- Email: `agent@example.com`
- Nom: `John Doe`
- Rôle: **Agent**
- Vues: ✓ Boite de reception (requis)

#### 2. Assigner les Boîtes Mail
- Cliquer sur l'agent pour l'éditer
- **Permissions des boites mail** :
  - Pour chaque boîte à donner accès:
    - ✓ **Lire** (obligatoire pour voir les tickets)
    - ✓ **Envoyer** (optionnel pour répondre)
- **Enregistrer**

#### 3. C'est Fait!
L'agent peut maintenant :
- ✓ Se connecter
- ✓ Voir ses boîtes mail dans le Sidebar
- ✓ Voir les tickets et emails
- ✓ Répondre aux clients (si "Envoyer" est activé)

## Pour l'Agent

### Vous Voyez Uniquement Vos Boîtes Autorisées

**Ce que vous voyez :**
- Boîtes mail assignées dans le Sidebar
- Tous les tickets de ces boîtes
- Tous les emails et pièces jointes
- Possibilité de répondre (si permission accordée)

**Ce que vous ne voyez pas :**
- Les boîtes des autres agents
- Les boîtes sans accès
- Les emails des boîtes sans accès

### Répondre à un Client

1. Inbox → Cliquer sur un ticket
2. Voir la conversation
3. Taper votre réponse
4. Cliquer "Envoyer" (si permission "Envoyer" est active)

## Permissions Expliquées Simplement

| Permission | Signifie | Effet |
|-----------|----------|--------|
| **Lire** | Je peux voir | Affiche la boîte et ses tickets |
| **Envoyer** | Je peux répondre | Permet de composer et envoyer des emails |
| **Gérer** | Je peux configurer | (Fonctionnalité future) |

**Important:** Un agent doit avoir "Lire" pour voir les tickets. "Envoyer" seul ne suffit pas.

## Dépannage Rapide

### "Je ne vois pas ma boîte mail"
1. Demander à l'admin de vérifier les permissions
2. Vérifier que **Lire** est coché
3. Rafraîchir la page (F5)

### "Je ne vois pas les tickets"
- Même chose que ci-dessus

### "Je ne peux pas envoyer un email"
- Vérifier que **Envoyer** est coché pour cette boîte

### "Je vois une boîte mais aucun ticket"
- Il n'y a peut-être aucun ticket dans cette boîte
- Vérifier le Sidebar → voir le nombre de tickets

## Interface Admin - Où Configurer

```
🔧 Admin
  ├─ Utilisateurs
  │  ├─ Voir liste des agents
  │  └─ Cliquer sur un agent pour éditer
  │     └─ Permissions des boites mail
  │        ├─ [✓ Lire] [  Envoyer] [  Gérer]  Boîte 1
  │        ├─ [  Lire] [✓ Envoyer] [  Gérer]  Boîte 2
  │        └─ [  Lire] [  Envoyer] [  Gérer]  Boîte 3
```

## Sécurité

- Les agents ne peuvent voir que leurs boîtes
- Les administrateurs voient tout
- Les données sont protégées par la base de données
- Impossible de contourner les permissions

## Besoin d'Aide?

Voir les documents détaillés :
- **AGENT_PERMISSIONS_GUIDE.md** - Guide complet
- **DEBUGGING_AGENT_ACCESS.md** - Résoudre les problèmes
- **AGENT_ACCESS_IMPLEMENTATION.md** - Détails techniques
