# Réinitialisation des données

Ce document explique comment remettre à zéro les données de l'application.

## ⚠️ ATTENTION

La réinitialisation des données est **IRRÉVERSIBLE**. Assurez-vous d'avoir une sauvegarde avant de procéder.

## Méthode 1 : Via Supabase Dashboard (Recommandé)

1. Connectez-vous au Dashboard Supabase
2. Allez dans **Table Editor**
3. Sélectionnez les tables dans cet ordre et supprimez les données :

```
1. internal_notes (notes internes)
2. attachments (pièces jointes)
3. emails (emails)
4. ai_classifications (classifications IA)
5. ai_response_suggestions (suggestions IA)
6. draft_generation_queue (file de génération de brouillons)
7. tickets (tickets) ← IMPORTANT
8. sync_jobs (jobs de synchronisation)
9. audit_log (logs d'audit - optionnel)
10. notifications (notifications - optionnel)
```

**Note** : Ne supprimez PAS les tables suivantes (données de configuration) :
- profiles (utilisateurs)
- mailboxes (boîtes mail)
- categories / subcategories (catégories)
- tags (étiquettes)
- email_templates (modèles d'email)
- ticket_statuses / ticket_priorities (statuts et priorités personnalisés)
- system_settings (paramètres système)
- knowledge_base_items (base de connaissances)
- rate_limit_config (configuration rate limiting)

## Méthode 2 : Via SQL (Avancé)

Exécutez ce SQL dans l'éditeur SQL de Supabase :

```sql
-- Désactiver temporairement les contraintes de clés étrangères
SET session_replication_role = 'replica';

-- Supprimer les données des tickets et contenus liés
TRUNCATE TABLE internal_notes CASCADE;
TRUNCATE TABLE attachments CASCADE;
TRUNCATE TABLE emails CASCADE;
TRUNCATE TABLE ai_classifications CASCADE;
TRUNCATE TABLE ai_response_suggestions CASCADE;
TRUNCATE TABLE draft_generation_queue CASCADE;
TRUNCATE TABLE tickets CASCADE;
TRUNCATE TABLE sync_jobs CASCADE;

-- Optionnel : nettoyer les logs et notifications
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- Réactiver les contraintes
SET session_replication_role = 'origin';

-- Vérification
SELECT
  'tickets' as table_name, COUNT(*) as count FROM tickets
UNION ALL
SELECT 'emails', COUNT(*) FROM emails
UNION ALL
SELECT 'attachments', COUNT(*) FROM attachments
UNION ALL
SELECT 'internal_notes', COUNT(*) FROM internal_notes;
```

## Méthode 3 : Réinitialisation complète (Tout supprimer)

⚠️ **DANGER** : Cela supprime TOUT, y compris les utilisateurs et la configuration !

```sql
-- NE PAS UTILISER EN PRODUCTION !
-- Cela supprime absolument toutes les données

SET session_replication_role = 'replica';

-- Supprimer toutes les données
TRUNCATE TABLE internal_notes CASCADE;
TRUNCATE TABLE attachments CASCADE;
TRUNCATE TABLE emails CASCADE;
TRUNCATE TABLE ai_classifications CASCADE;
TRUNCATE TABLE ai_response_suggestions CASCADE;
TRUNCATE TABLE draft_generation_queue CASCADE;
TRUNCATE TABLE tickets CASCADE;
TRUNCATE TABLE sync_jobs CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE knowledge_base_items CASCADE;
TRUNCATE TABLE template_versions CASCADE;
TRUNCATE TABLE template_tags CASCADE;
TRUNCATE TABLE ticket_tags CASCADE;
TRUNCATE TABLE email_templates CASCADE;
TRUNCATE TABLE mailbox_permissions CASCADE;
TRUNCATE TABLE mailboxes CASCADE;
TRUNCATE TABLE subcategories CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE tags CASCADE;
TRUNCATE TABLE ticket_statuses CASCADE;
TRUNCATE TABLE ticket_priorities CASCADE;
TRUNCATE TABLE system_settings CASCADE;
TRUNCATE TABLE profiles CASCADE;

SET session_replication_role = 'origin';

-- Recréer les données de base
INSERT INTO system_settings (key, value, updated_at) VALUES
  ('ai_features', '{"auto_classification": true, "smart_routing": true, "auto_draft_generation": false}'::jsonb, NOW()),
  ('email_settings', '{"default_signature": "Cordialement,\nL''équipe support"}'::jsonb, NOW());
```

## Après la réinitialisation

1. **Recréer un utilisateur admin** :
   - Le premier utilisateur créé devient automatiquement admin
   - Allez sur la page de login et créez un nouveau compte

2. **Reconfigurer les boîtes mail** :
   - Allez dans Admin > Boîtes mail
   - Ajoutez vos configurations IMAP/SMTP

3. **Recréer les catégories** (optionnel) :
   - Allez dans Admin > Catégories
   - Créez vos catégories de tickets

4. **Lancer une première synchronisation** :
   - Dans Admin > Boîtes mail > Diagnostics
   - Cliquez sur "Synchroniser maintenant"

## Scripts de réinitialisation rapide

### Supprimer uniquement les tickets (garder la config)

```sql
SET session_replication_role = 'replica';
TRUNCATE TABLE internal_notes, attachments, emails, ai_classifications,
               ai_response_suggestions, draft_generation_queue, tickets CASCADE;
SET session_replication_role = 'origin';
```

### Supprimer les tickets + logs (démarrage propre)

```sql
SET session_replication_role = 'replica';
TRUNCATE TABLE internal_notes, attachments, emails, ai_classifications,
               ai_response_suggestions, draft_generation_queue, tickets,
               sync_jobs, audit_log, notifications CASCADE;
SET session_replication_role = 'origin';
```

## Sauvegarde avant réinitialisation

Avant de supprimer des données, créez une sauvegarde :

```sql
-- Exporter les tickets vers un fichier JSON (via Dashboard > SQL Editor)
COPY (
  SELECT json_agg(t) FROM (
    SELECT * FROM tickets
  ) t
) TO '/tmp/tickets_backup.json';
```

Ou utilisez la fonctionnalité de backup automatique de Supabase (Dashboard > Database > Backups).

---

**Dernière mise à jour** : 15 février 2026
**Version** : 2.1.0
