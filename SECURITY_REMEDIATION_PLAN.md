# PLAN DE REMÉDIATION DE SÉCURITÉ - EmailOps

**Date**: 15 février 2026
**Durée estimée**: 5-7 jours développement + 2 jours tests
**Priorité**: 🔴 CRITIQUE - Bloquant pour production

---

## PHASE 1 - CORRECTIFS CRITIQUES (P0) - 2-3 jours

### 1.1 Chiffrement AES-256-GCM des credentials

**Objectif**: Protéger les mots de passe IMAP/SMTP/OVH stockés en base de données.

**Implémentation**:

1. **Créer une edge function `encrypt-credentials`**
   ```typescript
   // Utilise Web Crypto API (disponible dans Deno)
   - Algorithme: AES-256-GCM
   - Clé de chiffrement: variable d'environnement ENCRYPTION_KEY (32 bytes)
   - IV unique par credential (12 bytes aléatoires)
   - Format de sortage: base64(iv + authTag + ciphertext)
   ```

2. **Migration de la base de données**
   ```sql
   -- Ajouter colonne pour stocker l'IV et les données chiffrées
   ALTER TABLE mailboxes
     ADD COLUMN encrypted_password_secure TEXT,
     ADD COLUMN encryption_iv TEXT,
     ADD COLUMN encryption_version INT DEFAULT 1;
   ```

3. **Migrer les données existantes**
   - Script de migration pour chiffrer tous les passwords existants
   - Vérifier que tous les champs sensibles sont chiffrés
   - Supprimer l'ancien champ une fois migré

4. **Modifier les edge functions**
   - `sync-mailbox`: décrypter avant utilisation
   - `send-email`: décrypter avant utilisation
   - `process-sync-job`: décrypter avant utilisation

5. **Sécuriser le frontend**
   - Ne JAMAIS renvoyer de credentials au client
   - API `GET /mailboxes` ne retourne jamais `encrypted_password_secure`
   - Seules les edge functions backend peuvent décrypter

**Livrables**:
- ✅ Edge function `encrypt-credentials`
- ✅ Edge function `decrypt-credentials` (usage interne uniquement)
- ✅ Migration DB `add_secure_encryption.sql`
- ✅ Script de migration des données existantes
- ✅ Tests unitaires du chiffrement/déchiffrement

**Validation**:
- [ ] Aucun password en clair dans la DB
- [ ] Client ne peut jamais récupérer un password
- [ ] Chiffrement AES-256-GCM vérifié
- [ ] IV unique par credential

---

### 1.2 Activation 2FA/TOTP obligatoire

**Objectif**: Ajouter une seconde couche d'authentification pour tous les comptes.

**Implémentation**:

1. **Activer MFA dans Supabase Auth**
   ```typescript
   // Utiliser le système MFA natif de Supabase
   await supabase.auth.mfa.enroll({
     factorType: 'totp',
     friendlyName: 'EmailOps App'
   })
   ```

2. **Migration DB pour tracker le statut 2FA**
   ```sql
   ALTER TABLE profiles
     ADD COLUMN mfa_enabled BOOLEAN DEFAULT false,
     ADD COLUMN mfa_enforced_at TIMESTAMPTZ,
     ADD COLUMN backup_codes_generated_at TIMESTAMPTZ;
   ```

3. **Interface utilisateur**
   - Page de configuration 2FA dans les paramètres utilisateur
   - QR code pour scanner avec Google Authenticator / Authy
   - Génération de 10 codes de secours
   - Vérification du code TOTP avant activation

4. **Enforcement progressif**
   - Phase 1: 2FA optionnel (1 semaine)
   - Phase 2: 2FA obligatoire pour admins
   - Phase 3: 2FA obligatoire pour tous (avec délai de grâce)

5. **Protection des actions sensibles**
   - Vérifier MFA pour: suppression compte, export données, changement email
   - Politique RLS basée sur `auth.jwt()->>'aal'` (Assurance Level)

**Livrables**:
- ✅ Composant React `TwoFactorSetup`
- ✅ Composant React `TwoFactorChallenge`
- ✅ Migration DB pour tracker MFA
- ✅ Policy RLS pour actions sensibles
- ✅ Documentation utilisateur (comment activer 2FA)

**Validation**:
- [ ] Tous les admins ont 2FA activé
- [ ] Impossible de désactiver 2FA sans re-auth
- [ ] Codes de secours fonctionnels
- [ ] RLS vérifie AAL2 pour actions critiques

---

### 1.3 Rate Limiting

**Objectif**: Prévenir les attaques par force brute sur l'authentification et les APIs.

**Implémentation**:

1. **Rate limiting Supabase Auth (natif)**
   ```sql
   -- Supabase Auth a déjà du rate limiting intégré
   -- Vérifier la configuration dans le dashboard Supabase
   ```

2. **Rate limiting sur les Edge Functions**
   ```typescript
   // Créer un middleware de rate limiting
   // Utiliser Upstash Redis ou table DB avec TTL

   interface RateLimitConfig {
     maxRequests: number;
     windowMs: number;
     keyGenerator: (req: Request) => string;
   }

   // Exemples:
   // - Login: 5 tentatives / 15 minutes / IP
   // - API calls: 100 requêtes / minute / user
   // - Sync mailbox: 1 sync / 5 minutes / mailbox
   ```

3. **Table de tracking**
   ```sql
   CREATE TABLE rate_limit_tracker (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     identifier TEXT NOT NULL,
     action TEXT NOT NULL,
     attempt_count INT DEFAULT 1,
     window_start TIMESTAMPTZ DEFAULT now(),
     last_attempt TIMESTAMPTZ DEFAULT now(),
     blocked_until TIMESTAMPTZ
   );

   CREATE INDEX idx_rate_limit_identifier ON rate_limit_tracker(identifier, action);
   ```

4. **Lockout progressif**
   - 1ère violation: warning
   - 2ème violation: délai 5 minutes
   - 3ème violation: délai 1 heure
   - 4ème violation: délai 24 heures + alerte admin

5. **Intégration Captcha/Turnstile**
   - Cloudflare Turnstile (gratuit)
   - Activer après 3 échecs de connexion
   - Vérification côté serveur

**Livrables**:
- ✅ Middleware `rateLimitMiddleware.ts`
- ✅ Migration DB `rate_limit_tracker.sql`
- ✅ Edge function `check-rate-limit`
- ✅ Intégration Cloudflare Turnstile
- ✅ Alertes admin sur violations multiples

**Validation**:
- [ ] Max 5 login attempts / 15 min / IP
- [ ] Lockout progressif fonctionne
- [ ] Captcha apparaît après 3 échecs
- [ ] Alertes admin envoyées

---

### 1.4 Headers de sécurité HTTP

**Objectif**: Protéger contre XSS, clickjacking, injection de contenu.

**Implémentation**:

1. **Configuration Vite (vite.config.ts)**
   ```typescript
   export default defineConfig({
     server: {
       headers: {
         'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
         'X-Frame-Options': 'DENY',
         'X-Content-Type-Options': 'nosniff',
         'Referrer-Policy': 'strict-origin-when-cross-origin',
         'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
         'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
       }
     }
   })
   ```

2. **Headers sur les Edge Functions**
   ```typescript
   const securityHeaders = {
     'X-Content-Type-Options': 'nosniff',
     'X-Frame-Options': 'DENY',
     'Referrer-Policy': 'strict-origin-when-cross-origin'
   };
   ```

3. **Configuration _redirects pour Netlify/Vercel**
   ```
   /*
     X-Frame-Options: DENY
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: geolocation=(), microphone=(), camera=()
     Strict-Transport-Security: max-age=31536000; includeSubDomains
     Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ...
   ```

**Livrables**:
- ✅ Configuration `vite.config.ts` mise à jour
- ✅ Fichier `_headers` pour déploiement
- ✅ CSP policy stricte testée
- ✅ Documentation CSP pour futures modifications

**Validation**:
- [ ] Headers présents sur toutes les pages
- [ ] CSP ne bloque aucune fonctionnalité légitime
- [ ] Test securityheaders.com = A+
- [ ] Test Mozilla Observatory = A+

---

### 1.5 Audit Log complet

**Objectif**: Tracer toutes les actions sensibles pour détection d'intrusion et conformité.

**Implémentation**:

1. **Enrichir la table audit_log**
   ```sql
   ALTER TABLE audit_log
     ADD COLUMN ip_address INET,
     ADD COLUMN user_agent TEXT,
     ADD COLUMN session_id TEXT,
     ADD COLUMN risk_score INT DEFAULT 0,
     ADD COLUMN geo_location JSONB,
     ADD COLUMN device_fingerprint TEXT;

   -- Index pour recherches rapides
   CREATE INDEX idx_audit_log_user_time ON audit_log(user_id, created_at DESC);
   CREATE INDEX idx_audit_log_action_time ON audit_log(action, created_at DESC);
   CREATE INDEX idx_audit_log_ip ON audit_log(ip_address, created_at DESC);
   ```

2. **Events à logger**
   - ✅ Login réussi / échoué
   - ✅ Logout
   - ✅ Activation / désactivation 2FA
   - ✅ Changement de mot de passe
   - ✅ Changement d'email
   - ✅ Accès à une boîte mail
   - ✅ Lecture d'un email
   - ✅ Envoi d'email
   - ✅ Suppression de données
   - ✅ Export de données
   - ✅ Changement de rôle/permissions
   - ✅ Ajout/suppression collaborateur
   - ✅ Accès aux credentials (même chiffrés)

3. **Edge function d'audit**
   ```typescript
   // audit-logger/index.ts
   export async function logAuditEvent({
     userId,
     action,
     resource,
     details,
     ipAddress,
     userAgent,
     riskScore
   }) {
     // Enrichir avec geo-location
     // Calculer risk score basé sur:
     // - Heure inhabituelle
     // - IP inhabituelle
     // - Device inhabituel
     // - Action sensible

     await supabase.from('audit_log').insert({...});

     // Si risk_score > 80, envoyer alerte
     if (riskScore > 80) {
       await sendSecurityAlert({...});
     }
   }
   ```

4. **Interface admin pour consulter les logs**
   - Filtrage par utilisateur, action, date
   - Export CSV pour analyse
   - Alertes sur patterns suspects
   - Visualisation timeline

**Livrables**:
- ✅ Migration DB `enhanced_audit_log.sql`
- ✅ Edge function `audit-logger`
- ✅ Hook React `useAuditLog` pour logger côté client
- ✅ Composant `AuditLogViewer` amélioré
- ✅ Système d'alertes automatiques

**Validation**:
- [ ] Tous les events critiques sont loggés
- [ ] Logs immuables (pas de UPDATE/DELETE sauf admin)
- [ ] Recherche rapide < 500ms sur 1M+ logs
- [ ] Alertes envoyées pour activité suspecte

---

## PHASE 2 - SÉCURISATION (P1) - 2 jours

### 2.1 Migration sessions vers cookies HttpOnly

**Objectif**: Protéger les sessions contre vol via XSS.

**Implémentation**:

1. **Configuration Supabase Auth**
   ```typescript
   // src/lib/supabase.ts
   export const supabase = createClient(
     supabaseUrl,
     supabaseAnonKey,
     {
       auth: {
         storage: {
           // Custom storage adapter avec cookies
           getItem: (key) => getCookie(key),
           setItem: (key, value) => setCookie(key, value, {
             httpOnly: true,
             secure: true,
             sameSite: 'strict',
             maxAge: 60 * 60 * 8 // 8 heures
           }),
           removeItem: (key) => deleteCookie(key)
         },
         flowType: 'pkce', // Plus sécurisé
         autoRefreshToken: true,
         persistSession: true,
         detectSessionInUrl: true
       }
     }
   )
   ```

2. **Serveur SSR pour gérer les cookies**
   - Utiliser Vite SSR ou ajouter un petit serveur Express
   - Cookies HttpOnly ne sont pas accessibles en JS

**Livrables**:
- ✅ Configuration Supabase avec cookies
- ✅ Tests de session persistence

**Validation**:
- [ ] Sessions dans cookies HttpOnly
- [ ] Pas de session dans localStorage
- [ ] XSS ne peut pas voler les sessions

---

### 2.2 Sanitization HTML avec DOMPurify

**Objectif**: Prévenir XSS via emails HTML malveillants.

**Implémentation**:

1. **Edge function `sanitize-html`**
   ```typescript
   import { DOMPurify } from 'npm:isomorphic-dompurify';

   export function sanitizeEmail(html: string): string {
     return DOMPurify.sanitize(html, {
       ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote'],
       ALLOWED_ATTR: ['href', 'title', 'target'],
       FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
       FORBID_ATTR: ['onclick', 'onerror', 'onload', 'style'],
       ALLOW_DATA_ATTR: false,
       SAFE_FOR_TEMPLATES: true
     });
   }
   ```

2. **Sanitization lors de la synchronisation**
   - Sanitizer `body_html` avant stockage en DB
   - Stocker aussi une version `body_text` plain

3. **Affichage sécurisé côté client**
   - Utiliser `dangerouslySetInnerHTML` uniquement après sanitization
   - Option: afficher en iframe sandbox

**Livrables**:
- ✅ Edge function `sanitize-html`
- ✅ Migration pour sanitizer les emails existants
- ✅ Composant `SafeEmailViewer`

**Validation**:
- [ ] Aucun script ne peut s'exécuter depuis un email
- [ ] Test avec emails malveillants connus
- [ ] Formatting HTML préservé

---

### 2.3 Vérification email obligatoire

**Objectif**: Empêcher les comptes jetables et valider l'identité.

**Implémentation**:

1. **Activer email verification dans Supabase**
   - Dashboard > Authentication > Email Templates
   - Personnaliser le template de confirmation

2. **Bloquer l'accès sans verification**
   ```typescript
   // Middleware dans AuthContext
   if (!user.email_verified) {
     return <EmailVerificationRequired />;
   }
   ```

3. **Blacklist de domaines jetables**
   ```typescript
   const disposableEmailDomains = [
     'tempmail.com', 'guerrillamail.com', '10minutemail.com', ...
   ];
   ```

**Livrables**:
- ✅ Configuration Supabase Auth
- ✅ Composant `EmailVerificationRequired`
- ✅ Blacklist domaines jetables

**Validation**:
- [ ] Impossible de se connecter sans email vérifié
- [ ] Domaines jetables rejetés

---

### 2.4 Fix TLS verification

**Objectif**: Prévenir man-in-the-middle sur SMTP.

**Implémentation**:

```typescript
// send-email/index.ts
tls: {
  rejectUnauthorized: true, // ✅ ACTIVÉ
  minVersion: 'TLSv1.2'
}
```

**Validation**:
- [ ] Certificats invalides rejetés
- [ ] Connexions SMTP sécurisées

---

### 2.5 CORS restreint

**Objectif**: Limiter les origines autorisées.

**Implémentation**:

```typescript
const allowedOrigins = [
  'https://emailops.votredomaine.com',
  'https://app.votredomaine.com'
];

const origin = req.headers.get('origin');
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'null',
  ...
};
```

**Validation**:
- [ ] Requêtes d'origines non autorisées rejetées

---

## PHASE 3 - DURCISSEMENT (P2) - 1-2 jours

### 3.1 Politique mots de passe forte

```typescript
// Vérification côté client + serveur
const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  checkHaveIBeenPwned: true, // API HaveIBeenPwned
  preventCommonPasswords: true
};
```

### 3.2 Rotation des secrets

- Mécanisme pour changer ENCRYPTION_KEY sans downtime
- Versionning des clés (`encryption_version` dans DB)
- Script de re-chiffrement avec nouvelle clé

### 3.3 Chiffrement pièces jointes

- Chiffrer les fichiers avant upload vers Supabase Storage
- Liens signés temporaires (expiration 1h)

### 3.4 Tests sécurité automatisés

- Tests OWASP Top 10
- Scan de dépendances (npm audit)
- SAST avec SonarQube ou Semgrep

### 3.5 Documentation RGPD

- Registre des traitements
- Politique de confidentialité
- Procédure de droit à l'effacement
- DPO contact

---

## ARCHITECTURE CIBLE (SÉCURISÉE)

```
┌─────────────────────────────────────────┐
│   Browser                                │
│   ✅ Sessions: HttpOnly Cookies         │
│   ✅ CSP strict                          │
│   ✅ No inline scripts                   │
└──────────┬──────────────────────────────┘
           │ HTTPS only
           ↓
┌─────────────────────────────────────────┐
│   Edge Functions (Rate Limited)         │
│   ✅ CORS restreint                     │
│   ✅ Input validation                   │
│   ✅ Audit logging                      │
└──────────┬──────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│   Supabase Auth                          │
│   ✅ 2FA/TOTP obligatoire               │
│   ✅ Email verification                 │
│   ✅ Rate limiting natif                │
│   ✅ Session management                 │
└──────────┬──────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│   Database (RLS strict)                  │
│   ✅ Passwords: AES-256-GCM chiffrés    │
│   ✅ RLS policies strictes              │
│   ✅ Audit log immuable                 │
│   ✅ Encryption key dans secret manager │
└─────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│   Edge Function: decrypt-credentials     │
│   ✅ Service isolé                      │
│   ✅ Audit de chaque accès              │
│   ✅ TLS verification: true             │
└──────────┬──────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│   IMAP/SMTP Servers                      │
│   ✅ Connexions TLS vérifiées           │
│   ✅ Credentials jamais exposés         │
└─────────────────────────────────────────┘
```

---

## CHECKLIST AVANT PRODUCTION

### Authentification
- [ ] 2FA activé pour 100% des admins
- [ ] Email verification obligatoire
- [ ] Rate limiting sur login (5/15min)
- [ ] Lockout progressif fonctionne
- [ ] Captcha après 3 échecs

### Credentials
- [ ] Tous les passwords chiffrés AES-256-GCM
- [ ] ENCRYPTION_KEY dans secret manager
- [ ] IV unique par credential
- [ ] Client ne peut JAMAIS récupérer un password
- [ ] Audit log sur accès aux credentials

### Sessions
- [ ] HttpOnly cookies (pas localStorage)
- [ ] Secure + SameSite=Strict
- [ ] Expiration 8h avec refresh token
- [ ] Révocation immédiate fonctionne

### Network
- [ ] HTTPS partout (HSTS activé)
- [ ] TLS verification activée (rejectUnauthorized: true)
- [ ] CORS restreint aux domaines autorisés
- [ ] Rate limiting sur toutes les edge functions

### Headers
- [ ] CSP strict (pas de 'unsafe-inline')
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] HSTS: max-age=31536000
- [ ] Referrer-Policy: strict-origin-when-cross-origin

### Content
- [ ] Sanitization HTML avec DOMPurify
- [ ] Pas de dangerouslySetInnerHTML non sanitizé
- [ ] Input validation côté serveur
- [ ] SQL queries paramétrées (Supabase le fait)

### Audit & Monitoring
- [ ] Tous les events critiques loggés
- [ ] Logs immuables
- [ ] Alertes sur activité suspecte
- [ ] Dashboard admin fonctionnel
- [ ] Export audit logs possible

### RGPD
- [ ] Politique de confidentialité publiée
- [ ] Registre des traitements documenté
- [ ] Droit à l'effacement implémenté
- [ ] Minimisation des données
- [ ] Consentement explicite

### Tests
- [ ] Tests unitaires auth (2FA, rate limiting)
- [ ] Tests d'intégration
- [ ] Scan OWASP Top 10
- [ ] Penetration testing
- [ ] npm audit = 0 vulnérabilités

---

## DÉLAIS ET RESSOURCES

### Estimation
- **Phase 1 (P0)**: 2-3 jours dev + 1 jour tests = 3-4 jours
- **Phase 2 (P1)**: 2 jours dev + 0.5 jour tests = 2.5 jours
- **Phase 3 (P2)**: 1-2 jours dev + 0.5 jour tests = 1.5-2.5 jours

**Total**: 7-9 jours calendaires

### Ressources nécessaires
- 1 développeur full-stack (backend + frontend)
- 1 expert sécurité pour review (2-3h)
- 1 testeur pour penetration testing (1 jour)

### Environnements
- Dev: tests unitaires + intégration
- Staging: tests end-to-end + pen testing
- Prod: déploiement progressif avec feature flags

---

## PROCHAINES ÉTAPES IMMÉDIATES

1. **Validation du plan** : Review par l'équipe technique
2. **Setup environnement** : Créer ENCRYPTION_KEY, configurer secrets
3. **Développement Phase 1** : Focus sur chiffrement + 2FA
4. **Tests continus** : Tests automatisés à chaque commit
5. **Security review** : Audit externe avant prod

---

## CONTACT & ESCALATION

Pour toute question ou blocage :
- Technique: équipe dev
- Sécurité: CISO / expert sécurité
- Juridique: DPO pour questions RGPD

**Incident de sécurité**: escalation immédiate à l'équipe sécurité.

---

**Document maintenu par**: Équipe Sécurité
**Dernière mise à jour**: 15 février 2026
**Prochaine révision**: Après Phase 1 (audit intermédiaire)
