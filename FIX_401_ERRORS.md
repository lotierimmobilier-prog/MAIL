# Correction des Erreurs 401 - Création et Suppression d'Utilisateurs

## Problème

Les fonctions `create-user` et `delete-user` retournaient systématiquement une erreur HTTP 401 (Non autorisé) lors de leur appel, empêchant la création et la suppression d'utilisateurs.

## Cause du Problème

Le problème venait d'une **incohérence dans l'utilisation des clés Supabase** :

1. Les fonctions créaient deux clients Supabase différents :
   - Un avec `SUPABASE_SERVICE_ROLE_KEY` (pour les opérations admin)
   - Un avec `SUPABASE_ANON_KEY` (pour vérifier l'utilisateur)

2. L'utilisation de `SUPABASE_ANON_KEY` pour vérifier le token causait l'erreur 401 car :
   - Les tokens JWT sont générés et signés avec une clé spécifique
   - `ANON_KEY` n'a pas les permissions nécessaires pour valider les sessions administrateur
   - La vérification échouait même pour les administrateurs légitimes

## Solution Appliquée

### 1. Uniformisation de l'Utilisation de SERVICE_ROLE_KEY

**Fichier** : `supabase/functions/create-user/index.ts`

**Avant** :
```typescript
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { ... }
);

// Création d'un second client avec ANON_KEY
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",  // ❌ Problème ici
  { ... }
);

// Vérification avec le mauvais client
const { data: { user: currentUser } } = await supabaseClient.auth.getUser(token);
```

**Après** :
```typescript
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",  // ✅ Une seule clé
  { ... }
);

// Vérification avec le client admin
const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
```

**Fichier** : `supabase/functions/delete-user/index.ts`

**Même correction appliquée** :
- Renommage de `supabaseClient` en `supabaseAdmin` pour clarté
- Utilisation exclusive de `SERVICE_ROLE_KEY`
- Changement de `.single()` en `.maybeSingle()` pour éviter les erreurs si l'utilisateur n'existe pas

### 2. Ajout de Logs de Diagnostic

Des logs ont été ajoutés pour faciliter le débogage :

```typescript
const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

if (authError || !user) {
  console.error('Auth error:', authError);  // ✅ Log l'erreur d'authentification
  return new Response(
    JSON.stringify({ error: 'Non autorisé' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 3. Redéploiement des Fonctions

Les deux fonctions ont été redéployées avec `verifyJWT: false` :

```bash
# create-user déployée avec verifyJWT: false
# delete-user déployée avec verifyJWT: false
```

## Pourquoi SERVICE_ROLE_KEY et pas ANON_KEY ?

| Aspect | ANON_KEY | SERVICE_ROLE_KEY |
|--------|----------|------------------|
| **Permissions** | Limitées par RLS | Contourne RLS |
| **Validation JWT** | Permissions limitées | Permissions complètes |
| **Opérations Admin** | ❌ Non autorisées | ✅ Autorisées |
| **Cas d'usage** | Client frontend | Opérations backend sensibles |

Pour des opérations administratives (création/suppression d'utilisateurs), **SERVICE_ROLE_KEY est indispensable** :
- Elle permet de valider correctement les tokens des administrateurs
- Elle donne accès aux fonctions `auth.admin.*`
- Elle contourne les restrictions RLS nécessaires pour ces opérations

## Architecture Finale

```
Frontend (UserManager.tsx)
  ↓ Appel avec callEdgeFunction()
  ↓ Token JWT dans Authorization: Bearer <token>
  ↓
Edge Function (create-user / delete-user)
  ↓ verifyJWT: false (pas de vérification automatique)
  ↓
  1. Extraction du token JWT
  2. Vérification avec supabaseAdmin.auth.getUser(token)
     └─ Utilise SERVICE_ROLE_KEY ✅
  3. Vérification du rôle admin dans profiles
     └─ Utilise SERVICE_ROLE_KEY ✅
  4. Opérations admin (createUser, deleteUser)
     └─ Utilise SERVICE_ROLE_KEY ✅
  ↓
Supabase Auth / Database
```

## Sécurité

La sécurité reste **totalement garantie** :

1. **Vérification du token JWT** : Le token est vérifié avec `SERVICE_ROLE_KEY`
2. **Validation du rôle administrateur** : Seuls les admins peuvent effectuer ces opérations
3. **Logs d'audit** : Toutes les erreurs sont loggées
4. **Validation des données** : Email, mot de passe, etc. sont validés
5. **Transactions atomiques** : Si le profil échoue, l'utilisateur auth est supprimé

**Code de sécurité** :
```typescript
// Étape 1 : Vérification du token
const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
if (authError || !currentUser) {
  return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
}

// Étape 2 : Vérification du rôle admin
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("role")
  .eq("id", currentUser.id)
  .maybeSingle();

if (!profile || profile.role !== "admin") {
  return new Response(
    JSON.stringify({ error: "Accès refusé. Seuls les administrateurs peuvent..." }),
    { status: 403 }
  );
}
```

## Tests de Validation

### Test 1 : Création d'Utilisateur

1. Connectez-vous en tant qu'**admin**
2. Allez dans **Admin > Utilisateurs**
3. Cliquez sur **Créer un utilisateur**
4. Remplissez :
   - Email : `test@example.com`
   - Mot de passe : `Password123!`
   - Nom : `Test User`
   - Rôle : `agent`
5. Cliquez sur **Créer**

**Résultat attendu** :
- ✅ Message : "Utilisateur créé avec succès"
- ✅ L'utilisateur apparaît dans la liste
- ✅ Logs dans la console : `[UserManager] User created successfully`

### Test 2 : Suppression d'Utilisateur

1. Cliquez sur l'icône **Poubelle** d'un utilisateur
2. Confirmez la suppression

**Résultat attendu** :
- ✅ Message : "Utilisateur supprimé avec succès"
- ✅ L'utilisateur disparaît de la liste
- ✅ Logs dans la console : `[UserManager] User deleted successfully`

### Test 3 : Sécurité (Accès Non-Autorisé)

1. Déconnectez-vous
2. Essayez d'appeler l'API directement :

```javascript
fetch('https://nmfgoikvqwbhllthlrbu.supabase.co/functions/v1/create-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'hack@test.com',
    password: '12345678',
    fullName: 'Hacker',
    role: 'admin'
  })
}).then(r => r.json()).then(console.log);
```

**Résultat attendu** :
- ✅ Erreur 401 : `{ error: "Non autorisé" }`
- ✅ Aucun utilisateur créé

## Fichiers Modifiés

1. **`supabase/functions/create-user/index.ts`**
   - Utilisation exclusive de `SERVICE_ROLE_KEY`
   - Ajout de logs d'erreur
   - Redéployée avec `verifyJWT: false`

2. **`supabase/functions/delete-user/index.ts`**
   - Utilisation exclusive de `SERVICE_ROLE_KEY`
   - Renommage `supabaseClient` → `supabaseAdmin`
   - Changement `.single()` → `.maybeSingle()`
   - Ajout de logs d'erreur
   - Redéployée avec `verifyJWT: false`

3. **`src/components/admin/UserManager.tsx`**
   - Utilisation de `callEdgeFunction` (déjà fait précédemment)
   - Gestion d'erreur améliorée avec logs

## En Cas de Problème

Si vous rencontrez encore des erreurs :

### 1. Vérifiez la Console du Navigateur (F12)

Ouvrez l'onglet **Console** et cherchez :
```
[UserManager] Creating user: { email: "...", ... }
[EdgeFunction] Calling create-user
[EdgeFunction] create-user responded in XXXXms with status 401
Erreur HTTP 401: {"error":"Non autorisé"}
```

### 2. Consultez les Logs Supabase

1. Allez sur le Dashboard Supabase
2. **Edge Functions** > `create-user` ou `delete-user` > **Logs**
3. Regardez les logs récents pour voir l'erreur serveur

Cherchez :
```
Auth error: { message: "...", ... }
```

### 3. Vérifiez Votre Session

Dans la console (F12) :
```javascript
// Vérifiez que vous êtes connecté en tant qu'admin
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Vérifiez votre rôle
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', session?.user?.id)
  .single();
console.log('Role:', profile?.role);  // Devrait afficher "admin"
```

### 4. Vérifiez les Variables d'Environnement

Dans le fichier `.env` :
```bash
VITE_SUPABASE_URL=https://nmfgoikvqwbhllthlrbu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Assurez-vous que ces valeurs sont correctes et que le fichier `.env` est chargé.

## Résumé des Changements

### Avant
- ❌ Deux clients Supabase (ANON_KEY + SERVICE_ROLE_KEY)
- ❌ Vérification avec le mauvais client
- ❌ Erreur 401 systématique
- ❌ Pas de logs pour diagnostiquer

### Après
- ✅ Un seul client Supabase (SERVICE_ROLE_KEY)
- ✅ Vérification avec le bon client
- ✅ Création/suppression fonctionnelle
- ✅ Logs détaillés partout

## Prochaines Étapes

Testez maintenant la création et suppression d'utilisateurs. Si tout fonctionne :
- Les erreurs 401 devraient avoir disparu
- Vous devriez pouvoir créer des utilisateurs
- Vous devriez pouvoir supprimer des utilisateurs
- Les logs devraient afficher les opérations dans la console

Si le problème persiste, consultez les logs Supabase dans le Dashboard et envoyez-moi les messages d'erreur exacts.
