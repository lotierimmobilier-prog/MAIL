import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useMailboxSync() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

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
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        try {
          const { data: mailboxes } = await supabase
            .from('mailboxes')
            .select('id, email_address, is_active')
            .eq('is_active', true);

          if (!mailboxes || mailboxes.length === 0) return;

          const headers = {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          };

          const createJobUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sync-job`;
          const createRes = await fetch(createJobUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ batch_size: 30 })
          });

          if (!createRes.ok) return;

          const workerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-worker`;
          await fetch(workerUrl, {
            method: 'POST',
            headers,
          });

          const draftQueueUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-draft-queue`;
          await fetch(draftQueueUrl, {
            method: 'POST',
            headers,
          }).catch(() => {});

        } catch (error) {
          console.error('Sync error:', error);
        } finally {
          isSyncingRef.current = false;
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
