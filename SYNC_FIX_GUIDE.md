# Guide de correction de la synchronisation

## Problème identifié

La synchronisation des emails ne fonctionne pas à cause de:
1. Le mot de passe de la boîte mail est en `encrypted_placeholder`
2. Les batchs étaient trop gros (timeout)
3. Le système de décryptage n'était pas utilisé dans process-sync-job

## Corrections appliquées

### 1. Optimisation des batchs
- `create-sync-job`: Batch size réduit de 20 à **10 emails**
- `process-sync-job`: Batch size max réduit de 50 à **15 emails**
- Timeout réduit de 50s à **45s** pour plus de sécurité

### 2. Support du décryptage des mots de passe
- `process-sync-job` déchiffre maintenant `encrypted_password_secure`
- Fallback vers `encrypted_password` si le décryptage échoue

## Étapes pour résoudre le problème

### Option A : Re-sauvegarder la boîte mail (Recommandé)

1. **Aller dans Admin > Gestion des boîtes mail**
2. **Modifier la boîte mail gestion@...**
3. **Re-saisir le mot de passe IMAP**
4. **Sauvegarder**

Cela va chiffrer correctement le mot de passe dans `encrypted_password_secure`.

### Option B : Mise à jour manuelle via SQL (Si Option A ne marche pas)

Si vous connaissez le mot de passe en clair:

```sql
-- 1. Appeler l'edge function de chiffrement
-- (À faire depuis votre application web en tant qu'admin)
```

Depuis la console développeur du navigateur sur votre app:

```javascript
const password = 'votre_mot_de_passe_imap';
const mailboxId = '1000b1ab-ccde-4883-b124-aa114e84463e'; // ID de votre boîte mail

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-credentials`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation: 'encrypt',
      data: password,
      mailboxId: mailboxId
    })
  }
);

const { result, version } = await response.json();
console.log('Encrypted password:', result);

// Puis mettre à jour la boîte mail (nécessite admin)
const updateResponse = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-mailbox-credentials`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mailboxId: mailboxId,
      name: 'gestion@...',
      email_address: 'gestion@...',
      provider_type: 'imap',
      imap_host: 'ssl0.ovh.net',
      imap_port: 993,
      smtp_host: 'ssl0.ovh.net',
      smtp_port: 465,
      smtp_security: 'SSL',
      username: 'gestion@...',
      password: password,
      use_tls: true
    })
  }
);
```

## Test de la synchronisation

### 1. Vérifier que le mot de passe est bien enregistré

```sql
SELECT
  id,
  email_address,
  encrypted_password,
  encrypted_password_secure,
  encryption_version
FROM mailboxes
WHERE email_address LIKE '%gestion%';
```

Résultat attendu:
- `encrypted_password_secure` doit contenir une longue chaîne chiffrée
- `encrypted_password` peut être `encrypted_placeholder`

### 2. Lancer une synchronisation manuelle

Depuis l'application web:
1. Aller dans **Admin > Diagnostics boîtes mail**
2. Cliquer sur **Synchroniser maintenant** pour gestion@

OU depuis la console développeur:

```javascript
// Créer un job de sync
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sync-job`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ batch_size: 10 })
  }
);

const jobResult = await response.json();
console.log('Job créé:', jobResult);

// Attendre 2 secondes
await new Promise(resolve => setTimeout(resolve, 2000));

// Lancer le worker
const workerResponse = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-worker`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    }
  }
);

const workerResult = await workerResponse.json();
console.log('Worker result:', workerResult);
```

### 3. Vérifier la progression

```sql
-- Voir les jobs
SELECT
  id,
  status,
  job_type,
  progress,
  error_message,
  created_at
FROM sync_jobs
ORDER BY created_at DESC
LIMIT 5;

-- Voir combien d'emails sont synchronisés
SELECT COUNT(*) FROM emails;

-- Voir les emails récents
SELECT
  subject,
  from_address,
  received_at
FROM emails
ORDER BY received_at DESC
LIMIT 10;
```

## Temps de synchronisation estimés

Avec les nouveaux paramètres (batch de 10):

- **Avec Edge Functions uniquement**: 2-3 jours pour 18945 emails
  - 10 emails toutes les 10 minutes
  - Environ 60 emails/heure
  - 1440 emails/jour

- **Avec VPS Hostinger**: 1-2 heures pour tout synchroniser
  - 50 emails par batch
  - Pas de limitation de temps
  - Synchronisation continue

## Surveillance de la synchronisation

### Vérifier les logs des Edge Functions

Dans Supabase:
1. Aller dans **Edge Functions**
2. Sélectionner `job-worker` ou `process-sync-job`
3. Voir les logs

### Vérifier les erreurs

```sql
SELECT
  mailbox_id,
  status,
  error_message,
  progress
FROM sync_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

## Prochaines étapes recommandées

### Court terme (Immédiat)
1. Re-sauvegarder la boîte mail avec le bon mot de passe
2. Lancer une synchronisation test
3. Vérifier que les emails arrivent

### Moyen terme (Cette semaine)
1. Installer le worker sur votre VPS Hostinger (voir VPS_HOSTINGER_GUIDE.md)
2. Laisser tourner pour synchroniser tous les emails rapidement
3. Une fois terminé, réduire la fréquence de sync

### Long terme (Mois prochain)
1. Optimiser les index de base de données si nécessaire
2. Ajouter des alertes de surveillance
3. Considérer la classification automatique des emails

## Dépannage

### La synchronisation ne démarre pas
- Vérifier que `encrypted_password_secure` n'est pas vide
- Vérifier les credentials IMAP
- Vérifier les logs des Edge Functions

### Les emails arrivent très lentement
- C'est normal avec les Edge Functions (10 emails/10 min)
- Solution: Installer le worker VPS (voir VPS_HOSTINGER_GUIDE.md)

### Erreur "No password configured"
- Le mot de passe n'est pas enregistré
- Suivre l'Option A ci-dessus

### Erreur de connexion IMAP
- Vérifier les paramètres IMAP (host, port)
- Vérifier que le compte n'a pas de restriction
- Tester avec un client mail standard
