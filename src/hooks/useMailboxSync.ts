import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useMailboxSync() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function setupSync() {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'mailbox_sync_interval_seconds')
        .maybeSingle();

      const intervalSeconds = setting?.value ? parseInt(setting.value as string) : 600;
      const intervalMs = intervalSeconds * 1000;

      async function syncMailboxes() {
        try {
          const { data: mailboxes } = await supabase
            .from('mailboxes')
            .select('id, email_address, is_active')
            .eq('is_active', true);

          if (!mailboxes || mailboxes.length === 0) return;

          const createJobUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sync-job`;
          const headers = {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          };

          await fetch(createJobUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ batch_size: 30 })
          });

          setTimeout(async () => {
            try {
              const workerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-worker`;
              await fetch(workerUrl, {
                method: 'POST',
                headers,
              });

              setTimeout(async () => {
                try {
                  const draftQueueUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-draft-queue`;
                  await fetch(draftQueueUrl, {
                    method: 'POST',
                    headers,
                  });
                } catch (error) {
                  console.error('Erreur lors de la génération automatique des brouillons:', error);
                }
              }, 3000);
            } catch (error) {
              console.error('Erreur lors du déclenchement du worker:', error);
            }
          }, 2000);

        } catch (error) {
          console.error('Erreur lors de la synchronisation des boîtes mail:', error);
        }
      }

      syncMailboxes();

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(syncMailboxes, intervalMs);
    }

    setupSync();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
