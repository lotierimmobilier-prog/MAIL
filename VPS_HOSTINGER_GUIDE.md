# Guide VPS Hostinger - Synchronisation EmailOps

## Vue d'ensemble

Avec votre VPS Hostinger, vous pouvez créer un **serveur de synchronisation dédié** qui tourne 24/7 sans les limitations de temps des Edge Functions Supabase (50 secondes max).

## Avantages

- Synchronisation **rapide** et **continue** de tous vos emails
- Pas de limite de temps d'exécution
- Contrôle total sur la fréquence de synchronisation
- Coût déjà couvert par votre VPS existant
- Architecture professionnelle et scalable

## Architecture

```
VPS Hostinger (Node.js)
    ↓
Synchronisation IMAP continue
    ↓
Base de données Supabase
    ↑
Application Web (Vite/React)
```

## Installation sur VPS Hostinger

### Étape 1 : Connexion au VPS

```bash
ssh root@votre-ip-vps
```

### Étape 2 : Installer Node.js

```bash
# Mettre à jour le système
apt update && apt upgrade -y

# Installer Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

### Étape 3 : Créer le projet de synchronisation

```bash
# Créer le dossier du projet
mkdir -p /var/www/emailops-sync
cd /var/www/emailops-sync

# Initialiser le projet Node.js
npm init -y

# Installer les dépendances
npm install @supabase/supabase-js dotenv imap
```

### Étape 4 : Créer le fichier de configuration

Créer `/var/www/emailops-sync/.env`:

```env
SUPABASE_URL=votre_supabase_url
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
SYNC_INTERVAL_SECONDS=300
BATCH_SIZE=50
```

### Étape 5 : Créer le script de synchronisation

Créer `/var/www/emailops-sync/sync-worker.js`:

```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYNC_INTERVAL = (process.env.SYNC_INTERVAL_SECONDS || 300) * 1000;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;

async function createSyncJob() {
  try {
    console.log('[Sync Worker] Creating sync job...');

    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/create-sync-job`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batch_size: BATCH_SIZE })
      }
    );

    const result = await response.json();
    console.log('[Sync Worker] Job created:', result);

    return result;
  } catch (error) {
    console.error('[Sync Worker] Error creating job:', error);
  }
}

async function processJobs() {
  try {
    console.log('[Sync Worker] Processing pending jobs...');

    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/job-worker`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const result = await response.json();
    console.log('[Sync Worker] Jobs processed:', result);

    return result;
  } catch (error) {
    console.error('[Sync Worker] Error processing jobs:', error);
  }
}

async function syncCycle() {
  console.log('[Sync Worker] Starting sync cycle...');

  // Créer les jobs
  await createSyncJob();

  // Attendre 2 secondes
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Traiter les jobs (peut prendre plusieurs itérations)
  let jobsRemaining = true;
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (jobsRemaining && iterations < MAX_ITERATIONS) {
    const result = await processJobs();

    if (result && result.jobs_processed === 0) {
      jobsRemaining = false;
    }

    iterations++;

    if (jobsRemaining) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`[Sync Worker] Sync cycle completed (${iterations} iterations)`);
}

async function main() {
  console.log('[Sync Worker] EmailOps Sync Worker started');
  console.log(`[Sync Worker] Sync interval: ${SYNC_INTERVAL / 1000} seconds`);
  console.log(`[Sync Worker] Batch size: ${BATCH_SIZE}`);

  // Premier cycle immédiat
  await syncCycle();

  // Cycles suivants à intervalles réguliers
  setInterval(async () => {
    await syncCycle();
  }, SYNC_INTERVAL);
}

main().catch(error => {
  console.error('[Sync Worker] Fatal error:', error);
  process.exit(1);
});
```

### Étape 6 : Créer un service systemd

Créer `/etc/systemd/system/emailops-sync.service`:

```ini
[Unit]
Description=EmailOps Sync Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/emailops-sync
ExecStart=/usr/bin/node /var/www/emailops-sync/sync-worker.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Étape 7 : Démarrer le service

```bash
# Recharger systemd
systemctl daemon-reload

# Activer le service au démarrage
systemctl enable emailops-sync

# Démarrer le service
systemctl start emailops-sync

# Vérifier le statut
systemctl status emailops-sync

# Voir les logs en temps réel
journalctl -u emailops-sync -f
```

## Configuration recommandée

Pour 18945 emails à synchroniser:

### Option 1 : Synchronisation rapide initiale

```env
SYNC_INTERVAL_SECONDS=60    # Toutes les minutes
BATCH_SIZE=50                # 50 emails par batch
```

Temps estimé: **1-2 heures** pour tout synchroniser

### Option 2 : Synchronisation équilibrée

```env
SYNC_INTERVAL_SECONDS=300    # Toutes les 5 minutes
BATCH_SIZE=30                # 30 emails par batch
```

Temps estimé: **3-4 heures** pour tout synchroniser

### Option 3 : Synchronisation continue après l'initiale

```env
SYNC_INTERVAL_SECONDS=600    # Toutes les 10 minutes
BATCH_SIZE=20                # 20 emails par batch
```

## Surveillance

### Voir les logs

```bash
# Logs en temps réel
journalctl -u emailops-sync -f

# Dernières 100 lignes
journalctl -u emailops-sync -n 100

# Logs d'aujourd'hui
journalctl -u emailops-sync --since today
```

### Commandes utiles

```bash
# Redémarrer le service
systemctl restart emailops-sync

# Arrêter le service
systemctl stop emailops-sync

# Vérifier le statut
systemctl status emailops-sync
```

## Vérification de la progression

Dans votre application web, allez dans **Admin > Diagnostics boîtes mail** pour voir:
- Nombre d'emails synchronisés
- Statut des jobs
- Erreurs éventuelles

## Avantages de cette approche

1. **Performance**: Pas de timeout, synchronisation aussi rapide que possible
2. **Fiabilité**: Redémarre automatiquement en cas d'erreur
3. **Flexibilité**: Ajustez la fréquence selon vos besoins
4. **Coût**: Utilise votre VPS existant, pas de coûts supplémentaires
5. **Scalabilité**: Peut gérer des centaines de milliers d'emails

## Migration depuis le système actuel

Le système VPS cohabite parfaitement avec le système Edge Functions:
- Le VPS gère la synchronisation continue
- L'application web reste sur Supabase
- Aucune modification de l'interface nécessaire

## Support

Si vous rencontrez des problèmes:

1. Vérifier les logs: `journalctl -u emailops-sync -f`
2. Vérifier la connectivité: `curl https://votre-supabase-url/functions/v1/create-sync-job`
3. Vérifier les variables d'environnement dans `.env`
4. Redémarrer le service: `systemctl restart emailops-sync`
