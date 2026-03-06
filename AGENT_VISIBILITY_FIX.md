# Correctif - Visibilité des Agents sur les Tickets et Emails

## Problème Identifié
Les agents ne voyaient pas les tickets et emails même s'ils avaient les permissions dans la table `mailbox_permissions`. La raison était que les politiques RLS ne vérifiaient pas le flag `can_read`.

## Solutions Implémentées

### 1. Corrections des Politiques RLS (Migration: `fix_agent_ticket_visibility`)

**Avant :**
```sql
CREATE POLICY "Users read permitted tickets"
  ON tickets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM mailbox_permissions mp
            WHERE mp.mailbox_id = tickets.mailbox_id
            AND mp.user_id = auth.uid())
  );
```

**Après :**
```sql
CREATE POLICY "Users read permitted tickets"
  ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = tickets.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  );
```

### Tables Corrigées dans les RLS
1. **tickets** - SELECT, INSERT, UPDATE
2. **emails** - SELECT, INSERT
3. **internal_notes** - SELECT, INSERT
4. **attachments** - SELECT

Chaque politique maintenant vérifie explicitement :
- Agent = ADMIN ou MANAGER → Accès complet
- Agent = Autre rôle → Accès SEULEMENT si `can_read = true`

### 2. Optimisations Frontend

**InboxView** - Filtre intelligent des tickets :
```typescript
const readableIds = getReadableMailboxIds();

if (readableIds && readableIds.size > 0) {
  ticketQuery = ticketQuery.in('mailbox_id', Array.from(readableIds));
} else if (readableIds && readableIds.size === 0) {
  setTickets([]);
  return;
}
```

**DashboardView** - Statistiques filtrées :
- Toutes les requêtes de comptage incluent maintenant le filtre `mailbox_id`
- Les agents ne voient les stats que des boîtes autorisées
- Les statistiques par boîte sont limitées aux boîtes accessibles

**ReportsView** - Rapports filtrés :
- Les rapports de statut et priorité utilisent les boîtes autorisées
- L'export CSV ne contient que les données pertinentes

### 3. Hiérarchie d'Accès Maintenant Respectée

```
Admins/Managers
    ↓ (Accès à TOUT)
    ├─ Tous les tickets
    ├─ Tous les emails
    └─ Toutes les statistiques

Agents
    ↓ (Accès basé sur mailbox_permissions)
    ├─ can_read = true → Voir les tickets/emails
    ├─ can_send = true → Envoyer les emails
    └─ Statistiques limitées aux boîtes avec can_read = true
```

## Flux de Sécurité Complet

1. **Frontend Charge les Permissions**
   - Hook `useMailboxPermissions()` récupère la liste des boîtes
   - Filtre les boîtes visibles dans le UI

2. **Frontend Filtre les Requêtes**
   - `InboxView` ajoute `in('mailbox_id', allowedBoxes)`
   - `DashboardView` filtre les statistiques
   - `ReportsView` filtre les rapports

3. **Backend Valide avec RLS**
   - Même si le frontend est contourné, le RLS bloque l'accès
   - La base de données vérifie `can_read = true` avant de retourner les données
   - Les agents ne peuvent pas accéder aux boîtes d'autres personnes

4. **Données Retournées Filtrées**
   - Seuls les tickets des boîtes autorisées sont retournés
   - Seuls les emails des boîtes autorisées sont retournés
   - Les attachments ne sont accessibles que via les emails autorisés

## État d'un Agent Configuré

Exemple : Agent "Catia" avec accès à 2 boîtes mail

**Boîte 1: Lotier Immobilier - Principal**
- `can_read = true` → Voit les tickets et emails
- `can_send = true` → Peut envoyer des réponses
- Visible dans le Sidebar
- Tickets/emails chargés dans l'Inbox

**Boîte 2: Gestion Locative**
- `can_read = true` → Voit les tickets et emails
- `can_send = true` → Peut envoyer des réponses
- Visible dans le Sidebar
- Tickets/emails chargés dans l'Inbox

**Boîtes sans Permission**
- Ne sont jamais visibles dans le Sidebar
- Les tickets ne sont jamais retournés par la requête
- Impossible d'accéder même en URL directe (RLS bloque)

## Tests pour Vérifier

### ✓ L'agent doit voir
1. Les boîtes mail dans le Sidebar
2. Les tickets dans l'Inbox
3. Les emails dans les détails du ticket
4. Les pièces jointes
5. Les statistiques du Dashboard pour ses boîtes
6. Les rapports pour ses boîtes

### ✗ L'agent ne doit pas voir
1. Les boîtes pour lesquelles il n'a pas `can_read = true`
2. Les tickets d'autres boîtes
3. Les emails d'autres boîtes
4. Les statistiques d'autres boîtes
5. Pas de message d'erreur (données retournées vides gracieusement)

## Documentation Associée
- Voir `AGENT_PERMISSIONS_GUIDE.md` pour les détails de configuration
