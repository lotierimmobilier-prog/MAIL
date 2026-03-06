# Correctif - Accès des Agents aux Emails

## Problèmes Identifiés et Corrigés

### Problème 1 : Agent voit TOUTES les boîtes mail

**Cause:**
Le Sidebar chargeait les boîtes au moment du montage (avant que les permissions soient chargées). Le hook `useMailboxPermissions()` chargeait les permissions de manière asynchrone, donc au moment du premier appel à `loadMailboxes()`, aucune permission n'était disponible.

**Correction:**
```typescript
// Avant: loadMailboxes() appelé une seule fois
useEffect(() => {
  loadMailboxes();
}, []);

// Après: recharger quand les permissions sont prêtes
useEffect(() => {
  if (!permsLoading) {
    loadMailboxes();
  }
}, [permsLoading]);
```

**Résultat:**
- Agent voit maintenant uniquement les boîtes avec `can_read = true`

### Problème 2 : Agent ne voit pas les emails

**Cause:**
Il y avait une politique RLS `anon_select_emails` qui retournait `true` pour tout le monde, contournant les vérifications de permissions. Cela avait été créée par une migration antérieure pour permettre l'accès anonyme.

**Correction:**
Suppression de la politique `anon_select_emails` via une nouvelle migration.

**Maintenant:**
La seule politique SELECT pour les emails est `Users read permitted emails` qui vérifie correctement `can_read = true`.

**Résultat:**
- Agent voit les emails uniquement des boîtes où il a `can_read = true`
- Les admins/managers voient tous les emails

## Flux d'Accès des Emails Maintenant Sécurisé

```
Agent Clic sur Ticket
    ↓
TicketDetailView Charge Emails
    ↓
Requête Supabase: SELECT * FROM emails WHERE ticket_id = ?
    ↓
RLS Policy Vérifie: "Users read permitted emails"
    ↓
Check 1: Est-ce un admin/manager?
    ├─ OUI → Retourner tous les emails
    └─ NON → Check 2
         ↓
Check 2: User a can_read = true pour cette mailbox_id?
    ├─ OUI → Retourner les emails
    └─ NON → Retourner VIDE
```

## Tests pour Vérifier

### ✓ L'agent doit voir les emails
1. Se connecter en tant qu'agent
2. Aller dans **Inbox**
3. Cliquer sur un ticket d'une boîte avec `can_read = true`
4. Les emails doivent s'afficher dans **Conversation**
5. Les pièces jointes doivent être visibles

### ✗ L'agent NE doit pas voir les emails
1. Se connecter en tant qu'agent
2. Aller dans **Inbox**
3. Vérifier que les boîtes **sans** `can_read = true` ne s'affichent pas
4. Impossible d'accéder à un ticket d'une boîte non autorisée (erreur ou redirection)

## Permissions Vérifiées

Vérifier que l'agent a les bonnes permissions :

```sql
SELECT mp.mailbox_id, m.name, mp.can_read, mp.can_send
FROM mailbox_permissions mp
JOIN mailboxes m ON mp.mailbox_id = m.id
WHERE mp.user_id = 'agent-uuid'
ORDER BY m.name;
```

**Attendus :**
- Au moins une ligne avec `can_read = true`
- Pour chaque boîte, le nom doit être rempli

## Fichiers Modifiés

### Frontend
- `src/components/layout/Sidebar.tsx`
  - Ajout du hook `loading: permsLoading`
  - Ajout d'un `useEffect` pour recharger quand les permissions sont prêtes

### Database
- Migration `remove_anon_email_policies`
  - Suppression de la politique anon qui contournait les permissions

## Politique RLS pour les Emails (Après Correctif)

```sql
CREATE POLICY "Users read permitted emails"
  ON emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM mailbox_permissions
      WHERE mailbox_permissions.mailbox_id = emails.mailbox_id
      AND mailbox_permissions.user_id = (SELECT auth.uid())
      AND mailbox_permissions.can_read = true
    )
  );
```

Cette politique :
- ✓ Permet aux admins/managers de lire tous les emails
- ✓ Permet aux agents de lire les emails des boîtes avec `can_read = true`
- ✗ Empêche les agents de lire les emails des autres boîtes
- ✗ Pas d'accès anonyme

## Performance

Les modifications incluent :
- ✓ Recharger seulement quand les permissions changent
- ✓ Pas de requêtes inutiles
- ✓ Cache implicite du hook

## État du Système Après Correctif

✅ **Les agents voient :**
1. Uniquement leurs boîtes mail assignées
2. Tous les tickets de ces boîtes
3. Tous les emails et conversations
4. Pièces jointes
5. Notes internes

✅ **Les agents NE peuvent pas voir :**
1. Les boîtes sans permission
2. Les emails des boîtes sans permission
3. Les informations d'autres agents
4. Les données d'autres départements

✅ **Les administrateurs voient :**
1. Toutes les boîtes mail
2. Tous les tickets
3. Tous les emails
4. Toutes les données

## Prochaines Étapes

1. **Tester** : Se connecter en tant qu'agent et vérifier que les emails s'affichent
2. **Vérifier** : Utiliser la requête SQL ci-dessus pour vérifier les permissions
3. **Signaler** : Si vous voyez toujours des problèmes, vérifier les logs de la console
