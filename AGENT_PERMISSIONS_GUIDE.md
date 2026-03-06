# Guide des Autorisations Agents

## Architecture des Autorisations

Le système fonctionne avec deux niveaux de contrôle d'accès :

### 1. **Au niveau Frontend** (React)
- Hook `useMailboxPermissions()` charge les permissions de l'agent
- Filtre les boîtes mail affichées dans le Sidebar
- Filtre les tickets et emails dans les vues

### 2. **Au niveau Base de Données** (Supabase RLS)
- Politiques RLS vérifient les permissions avant de retourner les données
- Même si un utilisateur essaie de contourner le frontend, la DB bloque l'accès
- Vérification de `mailbox_permissions` table avec les flags `can_read` et `can_send`

## Permissions par Rôle

### Admins et Managers
- Accès à TOUTES les boîtes mail
- Accès à TOUS les tickets et emails
- Pas besoin d'entrée dans la table `mailbox_permissions`

### Agents
- Accès UNIQUEMENT aux boîtes mail spécifiées par l'admin
- Pour chaque boîte, trois permissions contrôlées :
  - **`can_read`** (par défaut: false)
    - Permet de VOIR les tickets et emails
    - Requis pour consulter la boîte
  - **`can_send`** (par défaut: false)
    - Permet d'ENVOYER des emails
    - Indépendant de `can_read`
  - **`can_manage`** (par défaut: false)
    - Permet de GÉRER les paramètres de la boîte
    - Non utilisé actuellement

### ReadOnly
- Accès basé sur `allowed_views` seulement
- Lecture seule, pas de modification

## Configuration des Permissions

### Via l'Interface Admin

1. Aller dans **Admin** > **Utilisateurs**
2. Cliquer sur un **Agent** pour l'éditer
3. Dans **Permissions des boites mail**, pour chaque boîte :
   - **Lire** : Cocher pour permettre de voir les tickets/emails
   - **Envoyer** : Cocher pour permettre d'envoyer des emails
   - **Gérer** : Cocher pour les fonctions futures

### SQL Direct
```sql
-- Donner à un agent accès lecture à une boîte
INSERT INTO mailbox_permissions (user_id, mailbox_id, can_read, can_send)
VALUES ('agent-uuid', 'mailbox-uuid', true, false)
ON CONFLICT (user_id, mailbox_id) DO UPDATE
SET can_read = true;

-- Ajouter accès envoi
UPDATE mailbox_permissions
SET can_send = true
WHERE user_id = 'agent-uuid' AND mailbox_id = 'mailbox-uuid';

-- Révoquer l'accès
DELETE FROM mailbox_permissions
WHERE user_id = 'agent-uuid' AND mailbox_id = 'mailbox-uuid';
```

## Ce qu'un Agent Voit

### Avec `can_read = true`
✓ Liste des tickets de la boîte
✓ Détails des tickets
✓ Historique des emails
✓ Pièces jointes
✓ Notes internes
✓ Statistiques du dashboard (boîtes autorisées uniquement)

### Sans `can_read = true`
✗ La boîte n'apparaît pas dans la liste
✗ Impossible d'accéder aux tickets
✗ Impossible de voir les emails
✗ Les statistiques n'incluent pas cette boîte

## Politiques RLS Appliquées

### Tickets
```sql
-- Agent voit les tickets SEULEMENT si can_read = true
USING (
  EXISTS (
    SELECT 1 FROM mailbox_permissions
    WHERE mailbox_id = tickets.mailbox_id
    AND user_id = current_user_id
    AND can_read = true
  )
  OR user.role IN ('admin', 'manager')
)
```

### Emails
```sql
-- Agent voit les emails SEULEMENT si can_read = true
USING (
  EXISTS (
    SELECT 1 FROM mailbox_permissions
    WHERE mailbox_id = emails.mailbox_id
    AND user_id = current_user_id
    AND can_read = true
  )
  OR user.role IN ('admin', 'manager')
)
```

### Envoi d'emails
```sql
-- Agent peut envoyer SEULEMENT si can_send = true
WITH CHECK (
  direction = 'inbound'
  OR EXISTS (
    SELECT 1 FROM mailbox_permissions
    WHERE mailbox_id = emails.mailbox_id
    AND user_id = current_user_id
    AND can_send = true
  )
  OR user.role IN ('admin', 'manager')
)
```

## Dépannage

### L'agent ne voit pas les boîtes mail
1. Vérifier qu'il a une entrée dans `mailbox_permissions`
2. Vérifier que `can_read = true`
3. Vérifier que `is_active = true` dans la table `profiles`

### L'agent ne voit pas les tickets
1. Vérifier les mêmes points ci-dessus
2. Vérifier que les tickets ont `archived = false`
3. Attendre le chargement des permissions (hook `permsLoading`)

### L'agent ne peut pas envoyer d'emails
1. Vérifier que `can_send = true` dans les permissions
2. Vérifier que `can_read = true` aussi (réduire la boîte)

## Vérifié que tout fonctionne

L'agent doit voir :
- ✓ Boîtes mail dans le Sidebar (si `can_read = true`)
- ✓ Tickets dans l'Inbox
- ✓ Emails dans les détails du ticket
- ✓ Statistiques du Dashboard (limitées à ses boîtes)
- ✓ Rapports (limitées à ses boîtes)
- ✓ Contacts des boîtes autorisées
