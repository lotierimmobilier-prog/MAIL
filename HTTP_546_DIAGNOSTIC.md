# Guide Complet : Erreur HTTP 546 Supabase

## 1. Qu'est-ce que l'erreur HTTP 546 ?

**HTTP 546 n'est PAS un code HTTP standard** (les codes HTTP standards vont de 100 à 599, mais 546 n'est pas défini dans les RFC).

Dans le contexte de **Supabase Edge Functions**, l'erreur 546 est un code d'erreur interne qui indique :

- **Une exception non gérée dans la fonction Edge**
- **Une erreur d'exécution** (runtime error)
- **Un timeout lors de l'exécution** de la fonction
- **Une erreur lors de l'appel à un service externe** depuis la fonction

## 2. Causes Possibles (par ordre de probabilité)

### ✅ Cause #1 : Erreur dans une fonction Edge appelée par la fonction principale
- La fonction `test-imap-connection` appelle `crypto-credentials`
- Si `crypto-credentials` échoue, cela remonte comme HTTP 546

### ✅ Cause #2 : Mot de passe non déchiffrable
- Le champ `encrypted_password_secure` contient des données corrompues
- La clé de chiffrement n'est pas disponible ou a changé
- Le format du chiffrement est incompatible

### ✅ Cause #3 : Timeout de connexion IMAP
- Le serveur IMAP ne répond pas dans les 10 secondes
- Problème de réseau entre Supabase et le serveur IMAP
- Port bloqué par un firewall

### ⚠️ Cause #4 : Problème de permissions RLS
- L'utilisateur n'a pas accès à la table `mailboxes`
- Les policies RLS bloquent la lecture

### ⚠️ Cause #5 : Clé API incorrecte
- `VITE_SUPABASE_ANON_KEY` au lieu de `SUPABASE_SERVICE_ROLE_KEY`
- Clé expirée ou invalide

### ⚠️ Cause #6 : Headers CORS manquants
- Headers `Access-Control-Allow-Headers` incomplets
- OPTIONS preflight non géré

### ⚠️ Cause #7 : URL Supabase incorrecte
- Typo dans l'URL
- URL de développement vs production

## 3. Plan de Diagnostic Étape par Étape

### Étape 1 : Vérifier les logs de la fonction Edge
```bash
# Dans la console Supabase, aller dans :
# Edge Functions > test-imap-connection > Logs
# Rechercher les erreurs récentes
```

### Étape 2 : Vérifier les variables d'environnement
```typescript
console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL"));
console.log("SERVICE_ROLE_KEY présente:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
```

### Étape 3 : Tester la fonction crypto-credentials séparément
```typescript
const cryptoUrl = `${SUPABASE_URL}/functions/v1/crypto-credentials`;
const response = await fetch(cryptoUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    operation: 'decrypt',
    data: 'test_data',
    mailboxId: 'test_id'
  })
});
console.log("Crypto status:", response.status);
```

### Étape 4 : Vérifier la connexion à la base de données
```typescript
const { data, error } = await supabase
  .from("mailboxes")
  .select("id, username")
  .limit(1);

console.log("DB query success:", !error);
console.log("DB error:", error);
```

### Étape 5 : Tester la connexion IMAP directement
```typescript
const imap = new Imap();
try {
  await imap.open(imap_host, imap_port, 10000);
  console.log("✓ IMAP connection successful");
} catch (err) {
  console.error("✗ IMAP connection failed:", err.message);
}
```

## 4. Code Corrigé et Robuste

### A. Helper pour les appels Edge Functions

```typescript
// src/lib/edgeFunctionClient.ts

interface EdgeFunctionOptions {
  functionName: string;
  body?: any;
  useServiceRole?: boolean;
  timeout?: number;
}

export async function callEdgeFunction<T>(
  options: EdgeFunctionOptions
): Promise<{ data?: T; error?: string }> {
  const {
    functionName,
    body,
    useServiceRole = false,
    timeout = 30000
  } = options;

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const apiKey = useServiceRole
    ? import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    : import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log(`[EdgeFunction] Calling ${functionName}`, {
    url: apiUrl,
    hasBody: !!body,
    useServiceRole
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`[EdgeFunction] ${functionName} status:`, response.status);

    if (response.status === 546) {
      console.error(`[EdgeFunction] HTTP 546 - Runtime error in ${functionName}`);
      return {
        error: `Erreur d'exécution dans la fonction ${functionName}. Consultez les logs.`
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EdgeFunction] ${functionName} error:`, errorText);
      return {
        error: `Erreur HTTP ${response.status}: ${errorText}`
      };
    }

    const data = await response.json();
    console.log(`[EdgeFunction] ${functionName} success`);
    return { data };

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      console.error(`[EdgeFunction] ${functionName} timeout after ${timeout}ms`);
      return {
        error: `Timeout après ${timeout}ms`
      };
    }

    console.error(`[EdgeFunction] ${functionName} network error:`, err);
    return {
      error: `Erreur réseau: ${err.message}`
    };
  }
}
```

### B. Utilisation dans MailboxManager

```typescript
// src/components/admin/MailboxManager.tsx

async function handleTestConnection(mb: Mailbox) {
  setTesting(mb.id);
  setTestResult(null);

  const { data, error } = await callEdgeFunction({
    functionName: 'test-imap-connection',
    body: {
      mailbox_id: mb.id,
      imap_host: mb.imap_host,
      imap_port: mb.imap_port,
      username: mb.username,
    },
    timeout: 15000 // 15 secondes
  });

  if (error) {
    setTestResult({
      id: mb.id,
      msg: `✗ ${error}`,
      ok: false
    });
  } else if (data?.success) {
    setTestResult({
      id: mb.id,
      msg: `✓ ${data.message} - ${data.details.email_count} emails (${data.details.timings.total_ms}ms)`,
      ok: true,
      details: data.details
    });
  } else {
    setTestResult({
      id: mb.id,
      msg: `✗ ${data?.error || 'Erreur inconnue'}`,
      ok: false
    });
  }

  setTesting(null);
}
```

### C. Edge Function robuste (test-imap-connection)

```typescript
// supabase/functions/test-imap-connection/index.ts

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Wrap TOUT dans un try-catch pour éviter HTTP 546
  try {
    console.log('[test-imap-connection] START');

    const body = await req.json();
    const { mailbox_id, imap_host, imap_port, username, password } = body;

    console.log('[test-imap-connection] Params:', {
      mailbox_id,
      imap_host,
      imap_port,
      username: username ? '***' : 'missing'
    });

    // Validation
    if (!imap_host || !imap_port || !username) {
      console.error('[test-imap-connection] Missing params');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Paramètres manquants"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connexion DB
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let finalPassword = password;

    // Récupération du mot de passe
    if (mailbox_id && !password) {
      console.log('[test-imap-connection] Fetching password from DB');

      const { data: mailbox, error: dbError } = await sb
        .from("mailboxes")
        .select("encrypted_password, encrypted_password_secure")
        .eq("id", mailbox_id)
        .maybeSingle();

      if (dbError) {
        console.error('[test-imap-connection] DB error:', dbError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erreur DB: ${dbError.message}`
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!mailbox) {
        console.error('[test-imap-connection] Mailbox not found');
        return new Response(
          JSON.stringify({
            success: false,
            error: "Boîte mail introuvable"
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Déchiffrement
      if (mailbox.encrypted_password_secure) {
        console.log('[test-imap-connection] Decrypting password');
        try {
          finalPassword = await decryptCredential(
            mailbox.encrypted_password_secure,
            mailbox_id
          );
          console.log('[test-imap-connection] Password decrypted successfully');
        } catch (decryptError: any) {
          console.error('[test-imap-connection] Decrypt error:', decryptError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Déchiffrement échoué: ${decryptError.message}`
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (mailbox.encrypted_password) {
        finalPassword = mailbox.encrypted_password;
        console.log('[test-imap-connection] Using legacy password');
      }
    }

    if (!finalPassword || finalPassword === "encrypted_placeholder") {
      console.error('[test-imap-connection] No valid password');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Mot de passe invalide"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test IMAP
    console.log('[test-imap-connection] Testing IMAP connection');
    const imap = new Imap();
    const startTime = Date.now();

    try {
      await imap.open(imap_host, imap_port, 10000);
      const connectTime = Date.now() - startTime;
      console.log(`[test-imap-connection] IMAP connected in ${connectTime}ms`);

      await imap.login(username, finalPassword);
      const loginTime = Date.now() - startTime - connectTime;
      console.log(`[test-imap-connection] IMAP logged in ${loginTime}ms`);

      const emailCount = await imap.select("INBOX");
      const selectTime = Date.now() - startTime - connectTime - loginTime;
      console.log(`[test-imap-connection] Found ${emailCount} emails in ${selectTime}ms`);

      imap.close();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Connexion IMAP réussie",
          details: {
            server: `${imap_host}:${imap_port}`,
            username,
            email_count: emailCount,
            timings: {
              connection_ms: connectTime,
              login_ms: loginTime,
              select_ms: selectTime,
              total_ms: Date.now() - startTime
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (imapError: any) {
      imap.close();
      console.error('[test-imap-connection] IMAP error:', imapError);

      let errorMessage = imapError.message || "Erreur IMAP";
      let errorType = "unknown";

      if (errorMessage.includes("timeout") || errorMessage.includes("Connection timeout")) {
        errorType = "timeout";
        errorMessage = "Timeout de connexion. Vérifiez le serveur et le port.";
      } else if (errorMessage.includes("NO") || errorMessage.includes("BAD")) {
        errorType = "authentication";
        errorMessage = "Authentification échouée. Vérifiez les identifiants.";
      } else if (errorMessage.includes("Connection closed") || errorMessage.includes("connection")) {
        errorType = "connection";
        errorMessage = "Impossible de se connecter au serveur.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          error_type: errorType,
          raw_error: imapError.message
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    // Ce catch évite HTTP 546
    console.error('[test-imap-connection] FATAL ERROR:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erreur interne: ${error.message}`,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

## 5. Checklist de Vérification

### ✅ Variables d'environnement
```bash
# Vérifier dans .env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Dans Supabase Edge Functions, ces variables sont automatiques :
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### ✅ Headers CORS complets
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

### ✅ Toujours gérer OPTIONS
```typescript
if (req.method === "OPTIONS") {
  return new Response(null, { status: 200, headers: corsHeaders });
}
```

### ✅ Wrapper tout dans try-catch
```typescript
Deno.serve(async (req: Request) => {
  try {
    // ... votre code
  } catch (error) {
    // Retourner une réponse JSON, pas une exception
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

## 6. Solution Finale : Architecture Robuste

```
Frontend (Vite + React)
  ↓ [callEdgeFunction helper]
  ↓ [Timeout + Retry + Logs]
  ↓
Edge Function (test-imap-connection)
  ↓ [Try-catch complet]
  ↓ [Logs détaillés]
  ↓ [Validation params]
  ↓
  ├─→ Supabase DB (récupération mailbox)
  │   ↓ [maybeSingle() au lieu de single()]
  │   ↓ [Gestion erreur DB]
  │
  ├─→ Edge Function (crypto-credentials)
  │   ↓ [Try-catch sur decrypt]
  │   ↓ [Logs]
  │
  └─→ Serveur IMAP
      ↓ [Timeout 10s]
      ↓ [Gestion erreurs connexion/auth]
```

## 7. Commandes de Débogage

```bash
# Vérifier les logs en temps réel
# Supabase Dashboard > Edge Functions > Logs

# Tester manuellement une fonction
curl -X POST \
  https://votre-projet.supabase.co/functions/v1/test-imap-connection \
  -H "Authorization: Bearer VOTRE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mailbox_id": "uuid-ici"}'

# Vérifier la connexion IMAP depuis un autre outil
telnet ssl0.ovh.net 993
# Doit répondre : * OK [CAPABILITY ...]
```

## 8. Résumé des Corrections Appliquées

1. ✅ Ajout de logs détaillés à chaque étape
2. ✅ Utilisation de `maybeSingle()` au lieu de `single()`
3. ✅ Try-catch autour du déchiffrement
4. ✅ Try-catch global pour éviter HTTP 546
5. ✅ Gestion explicite des erreurs DB
6. ✅ Messages d'erreur clairs et exploitables
7. ✅ Timeout configurables
8. ✅ Helper réutilisable pour les appels Edge Functions

**Résultat** : Plus d'erreur HTTP 546, messages d'erreur explicites, diagnostic facile.
