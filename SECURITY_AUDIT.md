# AUDIT DE SÉCURITÉ - EmailOps

**Date**: 15 février 2026
**Niveau de risque global**: 🔴 CRITIQUE

---

## RÉSUMÉ EXÉCUTIF

L'application présente **15 vulnérabilités critiques** qui exposent l'entreprise à :
- Vol de credentials email (IMAP/SMTP) stockés en clair
- Usurpation d'identité et accès non autorisé
- Fuite de données clients et emails confidentiels
- Attaques par force brute non détectées
- Non-conformité RGPD

**Action immédiate requise** avant toute mise en production.

---

## 🔴 VULNÉRABILITÉS CRITIQUES (Priorité P0)

### 1. MOTS DE PASSE STOCKÉS EN CLAIR
**Risque**: 🔴 CRITIQUE
**Impact**: Accès total aux boîtes email de l'entreprise

**Problème**:
- Champ `encrypted_password` dans la table `mailboxes` stocke les mots de passe IMAP/SMTP en texte brut
- `ovh_consumer_key` également stocké en clair
- Accessible via RLS aux utilisateurs ayant permission sur les mailboxes
- Code source: `sync-mailbox/index.ts:438`, `send-email/index.ts:233`

**Preuve**:
```typescript
// send-email/index.ts:233
mailbox.encrypted_password, // Note: dans une vraie production, il faudrait déchiffrer
```

**Conséquences**:
- N'importe quel administrateur ou utilisateur avec accès DB peut lire tous les mots de passe
- En cas de dump SQL ou backup compromis, tous les accès email sont exposés
- Impossible de révoquer l'accès sans changer les mots de passe réels

---

### 2. ABSENCE TOTALE DE 2FA/MFA
**Risque**: 🔴 CRITIQUE
**Impact**: Compte compromis = accès total aux emails clients

**Problème**:
- Authentification uniquement par email/mot de passe
- Aucune seconde couche de protection
- Un mot de passe volé = accès immédiat et complet

**Conséquences**:
- Phishing réussi = accès total
- Mot de passe faible = brute force possible
- Session hijacking sans détection

---

### 3. ABSENCE DE RATE LIMITING
**Risque**: 🔴 CRITIQUE
**Impact**: Attaques par force brute non détectées

**Problème**:
- Pas de limitation du nombre de tentatives de connexion
- Pas de rate limiting sur les edge functions
- Pas de détection d'attaques par force brute

**Conséquences**:
- Attaquant peut essayer des milliers de mots de passe
- Pas d'alerte sur tentatives massives
- Pas de lockout progressif

---

### 4. EDGE FUNCTIONS AVEC SERVICE_ROLE_KEY
**Risque**: 🔴 CRITIQUE
**Impact**: Bypass total des RLS

**Problème**:
```typescript
// sync-mailbox/index.ts:404
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

- Certaines fonctions utilisent SERVICE_ROLE_KEY qui bypass RLS
- Accès total à toutes les données sans vérification

---

### 5. TLS NON VÉRIFIÉ
**Risque**: 🔴 CRITIQUE
**Impact**: Man-in-the-middle sur envoi d'emails

**Problème**:
```typescript
// send-email/index.ts:64
tls: {
  rejectUnauthorized: false  // ⚠️ TRÈS DANGEREUX
}
```

**Conséquences**:
- Attaquant peut intercepter les communications SMTP
- Certificats invalides acceptés
- Pas de vérification de l'identité du serveur

---

## 🟠 VULNÉRABILITÉS MAJEURES (Priorité P1)

### 6. SESSIONS EN LOCALSTORAGE
**Risque**: 🟠 MAJEUR
**Impact**: Vol de session via XSS

**Problème**:
```typescript
// src/lib/supabase.ts:11
storage: window.localStorage
```

- Sessions stockées en localStorage (accessible en JS)
- Vulnérable aux attaques XSS
- Devrait utiliser des cookies HttpOnly

---

### 7. ABSENCE DE HEADERS DE SÉCURITÉ
**Risque**: 🟠 MAJEUR
**Impact**: Vulnérable XSS, clickjacking, injection

**Manquant**:
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Strict-Transport-Security (HSTS)

---

### 8. PAS DE VÉRIFICATION EMAIL
**Risque**: 🟠 MAJEUR
**Impact**: Comptes jetables, spam

**Problème**:
- Création de compte sans vérifier l'email
- Pas de protection contre emails jetables
- Pas de confirmation requise

---

### 9. ABSENCE D'AUDIT LOG DES CONNEXIONS
**Risque**: 🟠 MAJEUR
**Impact**: Impossible de détecter les intrusions

**Problème**:
- Table audit_log existe mais non utilisée pour auth
- Pas de log des :
  - Tentatives de connexion échouées
  - Connexions réussies
  - Changements de mot de passe
  - Activations/désactivations 2FA
  - Changements de rôle

---

### 10. PAS DE SANITIZATION HTML
**Risque**: 🟠 MAJEUR
**Impact**: XSS via emails malveillants

**Problème**:
- `body_html` stocké et affiché sans sanitization
- Pas de DOMPurify côté serveur
- Scripts malveillants dans emails peuvent s'exécuter

---

## 🟡 VULNÉRABILITÉS IMPORTANTES (Priorité P2)

### 11. CORS TROP PERMISSIF
**Risque**: 🟡 IMPORTANT

```typescript
"Access-Control-Allow-Origin": "*"
```

Devrait être limité aux domaines autorisés uniquement.

---

### 12. LOGS VERBEUX EN PRODUCTION
**Risque**: 🟡 IMPORTANT

```typescript
debug: true,
logger: true
```

Logs peuvent exposer des secrets, tokens, passwords en clair.

---

### 13. ABSENCE DE ROTATION DES SECRETS
**Risque**: 🟡 IMPORTANT

- Pas de mécanisme de rotation des credentials
- Pas d'expiration des tokens
- Pas de révocation possible

---

### 14. PAS DE CHIFFREMENT DES PIÈCES JOINTES
**Risque**: 🟡 IMPORTANT

- Pièces jointes stockées en clair dans Supabase Storage
- Pas de chiffrement at-rest côté application

---

### 15. PAS DE POLITIQUE DE MOTS DE PASSE
**Risque**: 🟡 IMPORTANT

- Pas de complexité minimale requise
- Pas de vérification contre mots de passe compromis
- Pas d'historique des mots de passe

---

## CONFORMITÉ RGPD

### ❌ Non-conformités identifiées:

1. **Absence de minimisation des données**
   - Logs trop verbeux conservant des données sensibles

2. **Pas de droit à l'effacement complet**
   - Suppression utilisateur implémentée mais pas testée pour conformité

3. **Absence de registre des traitements**
   - Pas de documentation des flux de données

4. **Pas de chiffrement adapté**
   - Données sensibles (passwords) en clair

5. **Absence de notification de violation**
   - Pas de mécanisme d'alerte en cas de breach

---

## ARCHITECTURE ACTUELLE (VULNÉRABLE)

```
┌─────────────┐
│   Browser   │
│ (localStorage│ ← Session vulnérable XSS
│  sessions)  │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────┐
│   Supabase Auth (OK)        │
│   - Email/Password only     │
│   - No 2FA                  │
│   - No rate limiting        │
└──────┬──────────────────────┘
       │
       ↓
┌─────────────────────────────┐
│   Database (RLS activé)     │
│   ❌ Passwords en CLAIR     │
│   ❌ OVH secrets en CLAIR   │
│   - RLS contournable via    │
│     SERVICE_ROLE_KEY        │
└──────┬──────────────────────┘
       │
       ↓
┌─────────────────────────────┐
│   Edge Functions            │
│   ❌ SERVICE_ROLE_KEY       │
│   ❌ No rate limiting       │
│   ❌ TLS non vérifié        │
│   ❌ CORS: *                │
└─────────────────────────────┘
```

---

## VECTEURS D'ATTAQUE IDENTIFIÉS

### 1. Accès non autorisé aux credentials email
1. Attaquant obtient accès DB (dump, backup, injection SQL)
2. Lit `encrypted_password` en clair dans table `mailboxes`
3. Accède à toutes les boîtes email de l'entreprise
4. Lit/supprime/envoie des emails

### 2. Brute force des comptes utilisateurs
1. Pas de rate limiting
2. Attaquant essaie 10,000 mots de passe/minute
3. Compromet un compte
4. Accède aux emails selon permissions RLS

### 3. XSS via session localStorage
1. Attaquant injecte XSS (via email HTML malveillant)
2. Vole le token de session dans localStorage
3. Usurpe l'identité de la victime
4. Accède aux emails et données

### 4. Man-in-the-middle SMTP
1. TLS non vérifié (`rejectUnauthorized: false`)
2. Attaquant intercepte connexion SMTP
3. Lit emails envoyés en transit
4. Modifie le contenu avant envoi

### 5. Phishing sans 2FA
1. Attaquant envoie email phishing
2. Utilisateur donne mot de passe
3. Pas de 2FA = accès immédiat
4. Attaquant télécharge tous les emails

---

## PLAN DE REMÉDIATION

Voir `SECURITY_REMEDIATION_PLAN.md`

---

## RECOMMANDATIONS IMMÉDIATES (AVANT PROD)

### ⚠️ STOP - NE PAS DÉPLOYER EN PRODUCTION SANS :

1. ✅ Chiffrement AES-256-GCM des credentials IMAP/SMTP/OVH
2. ✅ Activation 2FA/TOTP obligatoire pour tous les comptes
3. ✅ Rate limiting sur auth + edge functions
4. ✅ Migration sessions vers cookies HttpOnly
5. ✅ Headers de sécurité (CSP, HSTS, etc.)
6. ✅ Audit log complet des connexions
7. ✅ Sanitization HTML avec DOMPurify
8. ✅ Vérification TLS activée (rejectUnauthorized: true)
9. ✅ CORS restreint aux domaines autorisés
10. ✅ Tests de sécurité (OWASP Top 10)

---

## CONCLUSION

L'application est **actuellement NON SÉCURISÉE** pour un environnement de production manipulant des emails professionnels sensibles.

**Délai estimé pour sécurisation complète** : 5-7 jours de développement + 2 jours de tests de sécurité.

**Risque juridique** : En cas de breach, responsabilité RGPD engagée (amendes jusqu'à 4% du CA).

---

## CONTACT

Pour toute question sur cet audit, contacter l'équipe sécurité.

**Prochaine étape** : Voir `SECURITY_REMEDIATION_PLAN.md` pour le plan d'action détaillé.
