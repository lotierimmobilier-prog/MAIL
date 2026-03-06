/*
  # Supprimer les Politiques RLS trop Permissives pour les Emails

  1. Problème
    - anon_select_emails permet à TOUS de lire les emails
    - Cela contourne les vérifications can_read

  2. Solution
    - Supprimer la politique anon_select_emails
    - Garder uniquement "Users read permitted emails"

  3. Sécurité
    - Les emails ne sont accessibles que via les permissions
*/

DROP POLICY IF EXISTS "anon_select_emails" ON emails;
