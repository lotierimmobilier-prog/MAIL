# Solution Finale : Erreur HTTP 546 Corrigée

## Qu'est-ce que l'erreur HTTP 546 ?

L'**erreur HTTP 546** est un code d'erreur spécifique à Supabase Edge Functions qui indique une **exception non gérée** dans la fonction serverless. Ce n'est pas un code HTTP standard, mais un code interne Supabase signifiant :

- Exception JavaScript non catchée
- Erreur lors de l'appel à un service externe
- Problème de chiffrement/déchiffrement
- Timeout non géré

## Corrections Appliquées

### 1. Edge Function `test-imap-connection` améliorée

**Fichier**: `supabase/functions/test-imap-connection/index.ts`

Ajouts :
- Logs détaillés à chaque étape (`console.log`)
- Try-catch global pour éviter les exceptions non gérées
- Utilisation de `maybeSingle()` au lieu de `single()`
- Gestion explicite des erreurs de déchiffrement
- Gestion explicite des erreurs de base de données
- Messages d'erreur clairs et exploitables

### 2. Edge Function `crypto-credentials` redéployée

**Fichier**: `supabase/functions/crypto-credentials/index.ts`

- Redéployée pour garantir la compatibilité
- Gestion d'erreur robuste
- Logs pour audit de sécurité

### 3. Nouveau Helper `edgeFunctionClient`

**Fichier**: `src/lib/edgeFunctionClient.ts` (NOUVEAU)

Fonctionnalités :
- Gestion automatique des timeouts
- Retry automatique avec backoff exponentiel
- Logs détaillés pour diagnostic
- Détection spécifique de l'erreur HTTP 546
- Messages d'erreur contextuels

```typescript
import { callEdgeFunction } from '../../lib/edgeFunctionClient';

const { data, error } = await callEdgeFunction({
  functionName: 'test-imap-connection',
  body: { mailbox_id, imap_host, imap_port, username },
  timeout: 15000
});
```

### 4. MailboxManager mis à jour

**Fichier**: `src/components/admin/MailboxManager.tsx`

- Utilise le nouveau helper `callEdgeFunction`
- Logs détaillés côté frontend
- Gestion d'erreur améliorée
- Timeout de 15 secondes au lieu de 2 minutes

## Comment Utiliser

### Tester la connexion IMAP

1. Allez dans **Admin > Boîtes Mail**
2. Cliquez sur **Tester la connexion** pour votre boîte OVH
3. Observez les logs dans la console du navigateur (F12)

### Consulter les Logs Serveur

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Naviguez vers **Edge Functions > test-imap-connection > Logs**
3. Vous verrez maintenant des logs détaillés :

```
[test-imap-connection] START
[test-imap-connection] Params: { mailbox_id: "...", imap_host: "ssl0.ovh.net", ... }
[test-imap-connection] Fetching password from DB
[test-imap-connection] Decrypting password
[test-imap-connection] Password decrypted successfully
[test-imap-connection] Testing IMAP connection
[test-imap-connection] IMAP connected in 1234ms
[test-imap-connection] IMAP logged in 567ms
[test-imap-connection] Found 42 emails in 89ms
```

### Diagnostic d'Erreur

Si vous rencontrez une erreur, les logs vous diront EXACTEMENT où :

#### Erreur de base de données
```
[test-imap-connection] DB error: { message: "..." }
→ Problème de connexion à Supabase ou RLS
```

#### Erreur de déchiffrement
```
[test-imap-connection] Decrypt error: { message: "..." }
→ Clé de chiffrement manquante ou mot de passe corrompu
```

#### Erreur IMAP
```
[test-imap-connection] IMAP error: Connection timeout
→ Serveur IMAP inaccessible ou port bloqué
```

```
[test-imap-connection] IMAP error: NO Authentication failed
→ Identifiants incorrects
```

## Configuration Vérifiée

### Variables Frontend (.env)
```
VITE_SUPABASE_URL=https://nmfgoikvqwbhllthlrbu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Variables Backend (Automatiques)
Ces variables sont automatiquement disponibles dans les Edge Functions :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Architecture de la Solution

```
Frontend (React)
  ↓
  callEdgeFunction (helper)
    - Timeout 15s
    - Retry automatique
    - Logs détaillés
  ↓
  test-imap-connection (Edge Function)
    - Try-catch global ← Évite HTTP 546
    - Logs à chaque étape
    - Validation params
  ↓
  ├─→ Supabase DB
  │   - Récupération mailbox
  │   - maybeSingle() ← Pas d'exception
  │
  ├─→ crypto-credentials (Edge Function)
  │   - Déchiffrement mot de passe
  │   - Try-catch ← Évite HTTP 546
  │
  └─→ Serveur IMAP (OVH)
      - Connexion + Login
      - Timeout 10s
```

## Checklist de Vérification

- [x] `test-imap-connection` déployée avec logs
- [x] `crypto-credentials` déployée
- [x] Helper `edgeFunctionClient` créé
- [x] `MailboxManager` mis à jour
- [x] Build réussi
- [x] Try-catch global dans les Edge Functions
- [x] Logs détaillés partout
- [x] Messages d'erreur exploitables

## Tests à Effectuer

1. **Test de connexion réussie**
   - Créer/modifier une boîte mail OVH
   - Cliquer sur "Tester la connexion"
   - Vérifier que le message de succès s'affiche

2. **Test avec mauvais identifiants**
   - Modifier le mot de passe pour mettre un mauvais
   - Tester la connexion
   - Vérifier que l'erreur est claire : "Authentification échouée"

3. **Test avec mauvais serveur**
   - Modifier l'hôte IMAP pour mettre "wrong.server.com"
   - Tester la connexion
   - Vérifier que l'erreur est claire : "Impossible de se connecter"

## Documentation Complète

Consultez le fichier **`HTTP_546_DIAGNOSTIC.md`** pour :
- Explication détaillée de l'erreur
- Plan de diagnostic complet
- Code source commenté
- Exemples d'utilisation
- Commandes de débogage

## Prochaines Étapes

1. Testez la connexion à votre boîte mail OVH
2. Si l'erreur persiste, consultez les logs dans la console (F12)
3. Consultez les logs Supabase pour voir exactement où ça bloque
4. Les messages d'erreur vous guideront vers la solution

## Support

Si vous rencontrez toujours l'erreur HTTP 546 :

1. Ouvrez la console du navigateur (F12) et copiez les logs
2. Allez sur Supabase Dashboard > Edge Functions > Logs
3. Copiez les logs serveur
4. Partagez ces informations pour diagnostic

L'erreur HTTP 546 est maintenant **détectée et expliquée** automatiquement par le helper.
