# Implémentation Complète - Accès des Agents aux Boîtes Mail

## Résumé des Modifications

Le système a été configuré pour que les agents ne voient **uniquement** les tickets et emails des boîtes mail auxquelles ils ont accès, via les permissions définies par l'administrateur.

## Architecture Générale

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN INTERFACE                         │
│  (Admin > Utilisateurs > Éditer Agent)                      │
│                                                              │
│  Configure les permissions :                                │
│  - Lire (can_read)                                          │
│  - Envoyer (can_send)                                       │
│  - Gérer (can_manage)                                       │
└────────────────────┬────────────────────────────────────────┘
                     │ Sauvegarde dans
                     ▼
         ┌───────────────────────────┐
         │ mailbox_permissions table │
         │ (user_id, mailbox_id,     │
         │  can_read, can_send...)   │
         └────────────┬──────────────┘
                      │ Utilisé par
         ┌────────────▼──────────────┐
         │   Frontend (React)        │
         │ useMailboxPermissions()   │
         │ - Charger permissions     │
         │ - Filtrer boîtes affichées│
         │ - Filtrer requêtes        │
         └────────────┬──────────────┘
                      │ Envoit requête avec filtre
                      ▼
         ┌───────────────────────────┐
         │   Backend (Supabase)      │
         │   - RLS Policies Check    │
         │   - Valide can_read = true│
         │   - Retourne données OK   │
         └───────────────────────────┘
```

## Composants Modifiés

### 1. Frontend - Vues Filtrées

| Fichier | Modifications |
|---------|--------------|
| `InboxView.tsx` | Filtre les tickets par `mailbox_id` |
| `DashboardView.tsx` | Filtre toutes les requêtes par `mailbox_id` |
| `ReportsView.tsx` | Filtre par permissions |
| `TicketDetailView.tsx` | Vérifie `canReadMailbox()` |

### 2. Database - RLS Policies

**Migration: `fix_agent_ticket_visibility`**

Politiques RLS mises à jour pour :
- ✓ `tickets` (SELECT, INSERT, UPDATE)
- ✓ `emails` (SELECT, INSERT)
- ✓ `internal_notes` (SELECT, INSERT)
- ✓ `attachments` (SELECT)

Chaque politique maintenant vérifie :
```
IF user.role IN ('admin', 'manager')
  → Accès complet
ELSE IF user.role = 'agent'
  → Vérifier mailbox_permissions.can_read = true
ELSE
  → Aucun accès
```

### 3. Hook - Gestion des Permissions

**`useMailboxPermissions.ts`**
- Charge les permissions de l'agent depuis la DB
- Fournit des fonctions de vérification :
  - `canReadMailbox(id)` → boolean
  - `canSendMailbox(id)` → boolean
  - `getReadableMailboxIds()` → Set<string> | null

## Configuration d'un Agent

### Via l'Interface Admin

1. **Admin** > **Utilisateurs** > **Créer / Éditer**
2. Rôle : **Agent**
3. Vues autorisées : **Boite de reception** (minimum)
4. **Permissions des boites mail** :
   - Cocher **Lire** pour que l'agent voie les tickets
   - Cocher **Envoyer** pour que l'agent puisse répondre
5. **Enregistrer**

### Via SQL Direct

```sql
-- Créer l'agent
INSERT INTO profiles (id, email, full_name, role, is_active, avatar_color, allowed_views)
VALUES (auth.uid(), 'agent@example.com', 'John Doe', 'agent', true, '#3B82F6', ARRAY['inbox', 'contacts']);

-- Donner accès à une boîte
INSERT INTO mailbox_permissions (user_id, mailbox_id, can_read, can_send)
VALUES ('agent-uuid', 'mailbox-uuid', true, false);
```

## Ce que l'Agent Voit

### ✓ Avec Permissions

- **Sidebar** : Boîtes mail avec `can_read = true`
- **Inbox** : Tickets de ces boîtes
- **Détails Ticket** : Tous les emails de ce ticket
- **Pièces Jointes** : Accessibles depuis les emails
- **Dashboard** : Statistiques des boîtes autorisées seulement
- **Rapports** : Données des boîtes autorisées

### ✗ Sans Permissions

- Boîtes mail ne s'affichent pas
- Impossible d'accéder aux tickets (RLS bloque)
- Impossible d'accéder aux emails
- Les statistiques excluent ces boîtes
- Les rapports n'en parlent pas

## Sécurité en Couches

### Couche 1: Frontend
- Hook `useMailboxPermissions()` charge les permissions
- Filtre les requêtes avant de les envoyer
- Sidebar n'affiche que les boîtes autorisées

### Couche 2: Database
- RLS policies vérifient les permissions
- Même requête brute envoyée directement est bloquée
- Données jamais retournées sans autorisation

### Couche 3: Chiffrement
- Credentials des boîtes mail sont chiffrés
- Les secrets n'exposeront jamais les permissions

## Permissions Détaillées

### can_read (Lecture)
```
Permission : can_read = true
Permet de :
  ✓ Voir la boîte dans le Sidebar
  ✓ Voir les tickets
  ✓ Voir les emails
  ✓ Voir les pièces jointes
  ✓ Voir les notes internes
  ✓ Apparaître dans les statistiques
```

### can_send (Envoi)
```
Permission : can_send = true
Permet de :
  ✓ Envoyer une réponse par email
  ✓ Créer un brouillon
Requiert : can_read = true aussi
```

### can_manage (Gestion)
```
Permission : can_manage = true
Permet de : (Actuellement non utilisé)
  (Future fonctionnalité de gestion de boîte)
```

## Vérifications de Sécurité

### ✓ Toutes les Requêtes Filtrées
- Les boîtes mail non accessibles ne sont jamais chargées
- Les tickets ne sont jamais retournés sans permission
- Les emails suivent les mêmes restrictions

### ✓ RLS Double-Check
- Même si le frontend est contourné (dev tools), le RLS bloque
- Les requêtes SQL directes dans la console sont bloquées
- Les API ne peuvent pas retourner des données non autorisées

### ✓ Pas de Fuite de Données
- Les agents ne voient pas les boîtes des autres
- Les statistiques ne révèlent que leurs propres données
- Les rapports ne contiennent que leurs données

## Documentation Associée

1. **AGENT_PERMISSIONS_GUIDE.md** - Guide complet de configuration
2. **AGENT_VISIBILITY_FIX.md** - Détails techniques du correctif
3. **DEBUGGING_AGENT_ACCESS.md** - Guide de débogage

## Checklist de Vérification

Après avoir configuré un agent :

- [ ] Agent créé dans Admin > Utilisateurs
- [ ] Rôle défini à "Agent"
- [ ] Au moins une boîte mail assignée avec "Lire" coché
- [ ] Agent peut se connecter
- [ ] Sidebar affiche la boîte mail
- [ ] Inbox affiche les tickets de cette boîte
- [ ] Clic sur ticket montre les emails
- [ ] Dashboard montre statistiques de cette boîte
- [ ] Rapports contiennent données de cette boîte
- [ ] Agent ne peut pas accéder à d'autres boîtes

## Performance

Les modifications incluent des optimisations :

- Index sur `mailbox_permissions(user_id, mailbox_id)` pour lectures rapides
- Filtrage côté requête (plus efficace que filtrage côté app)
- Cache implicite via le hook `useMailboxPermissions()`
- Utilisation de `in()` pour filtrer plusieurs boîtes en une requête

## État du Système

✓ **Implémentation Complète**
- Toutes les migrations appliquées
- Frontend modifié pour filtrer par permissions
- RLS policies configurées
- Documentation complète fournie

✓ **Prêt pour Production**
- Sécurité en couches
- Performance optimisée
- Aucune fuite de données

✓ **Facile à Utiliser**
- Interface admin intuitive
- Configuration simple par boîte
- Documentation claire pour l'administration
