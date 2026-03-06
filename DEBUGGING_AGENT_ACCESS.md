# Débogage - Vérifier que les Agents Voient les Données

## Si l'agent ne voit toujours pas les tickets/emails

### Étape 1: Vérifier les Permissions en Base de Données

```sql
-- Vérifier les permissions d'un agent spécifique
SELECT p.id, p.full_name, p.email, p.role,
       mp.mailbox_id, m.name, mp.can_read, mp.can_send
FROM profiles p
LEFT JOIN mailbox_permissions mp ON p.id = mp.user_id
LEFT JOIN mailboxes m ON mp.mailbox_id = m.id
WHERE p.email = 'agent@example.com'
ORDER BY m.name;
```

**Ce qu'il faut voir :**
- L'agent doit avoir au moins une ligne avec `can_read = true`
- La colonne `mailbox_name` doit être remplie (pas NULL)

### Étape 2: Vérifier que la Boîte Mail Existe et est Active

```sql
-- Vérifier les boîtes mail de l'agent
SELECT m.id, m.name, m.email_address, m.is_active
FROM mailboxes m
WHERE m.is_active = true
ORDER BY m.name;
```

**Ce qu'il faut voir :**
- La boîte doit avoir `is_active = true`
- Son ID doit correspondre à celui dans `mailbox_permissions`

### Étape 3: Vérifier les Tickets Associés

```sql
-- Vérifier les tickets pour les boîtes de l'agent
SELECT t.id, t.subject, t.mailbox_id, m.name, t.archived, t.created_at
FROM tickets t
JOIN mailboxes m ON t.mailbox_id = m.id
WHERE m.id IN (
  SELECT mp.mailbox_id
  FROM mailbox_permissions mp
  WHERE mp.user_id = 'agent-uuid'
  AND mp.can_read = true
)
AND t.archived = false
ORDER BY t.created_at DESC
LIMIT 10;
```

**Ce qu'il faut voir :**
- Au moins quelques tickets avec `archived = false`
- Les mailbox_id doivent avoir `can_read = true`

### Étape 4: Tester le RLS Directement

```sql
-- Simuler une requête d'agent
-- (Exécuter en tant que l'agent si possible)

SELECT id, subject, mailbox_id
FROM tickets
WHERE archived = false
LIMIT 5;
```

**Résultats attendus :**
- Si l'agent a `can_read = true` → Voir les tickets
- Si pas de permission → 0 résultats (pas d'erreur)

## Problèmes Courants et Solutions

### Problème: "Aucun ticket visible"

**Cause 1: Pas d'entrée dans `mailbox_permissions`**
```sql
-- Solution: Ajouter l'agent à une boîte
INSERT INTO mailbox_permissions (user_id, mailbox_id, can_read, can_send)
SELECT
  'agent-uuid',
  id,
  true,
  false
FROM mailboxes
LIMIT 1;
```

**Cause 2: `can_read = false`**
```sql
-- Solution: Activer la lecture
UPDATE mailbox_permissions
SET can_read = true
WHERE user_id = 'agent-uuid'
AND mailbox_id = 'mailbox-uuid';
```

**Cause 3: Boîte mail désactivée**
```sql
-- Solution: Vérifier que la boîte est active
UPDATE mailboxes
SET is_active = true
WHERE id = 'mailbox-uuid';
```

**Cause 4: Tous les tickets sont archivés**
```sql
-- Vérifier les tickets archivés
SELECT COUNT(*) as archived_tickets
FROM tickets
WHERE mailbox_id = 'mailbox-uuid'
AND archived = true;

SELECT COUNT(*) as active_tickets
FROM tickets
WHERE mailbox_id = 'mailbox-uuid'
AND archived = false;
```

### Problème: "L'agent ne peut pas envoyer d'emails"

```sql
-- Vérifier que can_send = true
SELECT can_send
FROM mailbox_permissions
WHERE user_id = 'agent-uuid'
AND mailbox_id = 'mailbox-uuid';

-- Si false, le corriger:
UPDATE mailbox_permissions
SET can_send = true
WHERE user_id = 'agent-uuid'
AND mailbox_id = 'mailbox-uuid';
```

### Problème: "Le dashboard ne montre pas les statistiques"

```sql
-- Vérifier qu'il y a au moins un ticket créé
SELECT COUNT(*) as total_tickets
FROM tickets
WHERE mailbox_id IN (
  SELECT mailbox_id
  FROM mailbox_permissions
  WHERE user_id = 'agent-uuid'
  AND can_read = true
);
```

## Vérification Complète via Frontend

### Console du Navigateur (F12 > Console)

```javascript
// Vérifier les permissions chargées
// Ouvrir la console et exécuter après avoir attendu le chargement

// Les permissions devraient être chargées dans le contexte
// Cela dépend de l'implémentation du hook useMailboxPermissions

// Vérifier l'URL de la requête Supabase
// Network > Filtre par "tickets" ou "mailbox"
// Vérifier que le filtre "mailbox_id IN (...)" est bien envoyé
```

### Vérifier via les Logs

1. Ouvrir **DevTools** (F12)
2. Aller dans **Network**
3. Rafraîchir la page (F5)
4. Chercher une requête contenant "tickets"
5. Cliquer dessus et regarder les paramètres
6. Vérifier que `in(mailbox_id,...)` ou `eq(mailbox_id,...)` est présent

## Checklist de Configuration

- [ ] Agent créé dans la table `profiles` avec `role = 'agent'`
- [ ] Agent a au moins une entrée dans `mailbox_permissions`
- [ ] Cette entrée a `can_read = true`
- [ ] La boîte mail existe et a `is_active = true`
- [ ] Il existe au least un ticket avec `archived = false` dans cette boîte
- [ ] L'agent n'est pas `is_active = false`

## Logs à Chercher

### PostgreSQL Logs
Si vous avez accès aux logs de la base de données :

```
-- Chercher les erreurs RLS
ERROR: new row violates row-level security policy

-- Chercher les accès bloqués
policy "Users read permitted tickets" ... USING clause evaluated to false
```

### Supabase Logs
1. Aller dans le dashboard Supabase
2. Chercher les logs de la base de données
3. Filtrer par l'utilisateur (email ou user_id)
4. Chercher les erreurs ou les requêtes bloquées

## Réinitialiser Complètement un Agent

Si tout est mélangé, recommencer zéro :

```sql
-- 1. Supprimer toutes les permissions de l'agent
DELETE FROM mailbox_permissions
WHERE user_id = 'agent-uuid';

-- 2. Vérifier que l'agent est actif
UPDATE profiles
SET is_active = true
WHERE id = 'agent-uuid';

-- 3. Ajouter une seule permission pour tester
INSERT INTO mailbox_permissions (user_id, mailbox_id, can_read, can_send)
VALUES (
  'agent-uuid',
  (SELECT id FROM mailboxes WHERE is_active = true LIMIT 1),
  true,
  false
);

-- 4. Vérifier que tout est bon
SELECT p.full_name, m.name, mp.can_read, mp.can_send
FROM profiles p
LEFT JOIN mailbox_permissions mp ON p.id = mp.user_id
LEFT JOIN mailboxes m ON mp.mailbox_id = m.id
WHERE p.id = 'agent-uuid';
```

Ensuite, ouvrir le navigateur et rafraîchir la page de l'agent.
