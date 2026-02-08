import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface SyncJobStatus {
  syncing: boolean;
  message: { text: string; ok: boolean } | null;
}

export function useSyncJobs() {
  const [status, setStatus] = useState<SyncJobStatus>({
    syncing: false,
    message: null,
  });

  const startSync = useCallback(async (mailboxId?: string) => {
    setStatus({ syncing: true, message: null });

    try {
      const createJobUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sync-job`;
      const createRes = await fetch(createJobUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mailbox_id: mailboxId,
          batch_size: 30,
          job_type: 'incremental_sync',
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || createData.error) {
        throw new Error(createData.error || 'Failed to create sync job');
      }

      if (!createData.jobs || createData.jobs.length === 0) {
        setStatus({
          syncing: false,
          message: { text: 'Aucun job de synchronisation créé', ok: false },
        });
        return;
      }

      setStatus({
        syncing: false,
        message: {
          text: `${createData.jobs.length} synchronisation(s) démarrée(s). Le traitement se poursuit en arrière-plan.`,
          ok: true,
        },
      });

      setTimeout(async () => {
        try {
          const workerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-worker`;
          await fetch(workerUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (err) {
          console.error('Error triggering job worker:', err);
        }
      }, 1000);

    } catch (err: any) {
      console.error('Sync error:', err);
      setStatus({
        syncing: false,
        message: { text: `Erreur: ${err.message}`, ok: false },
      });
    }
  }, []);

  const getSyncStatus = useCallback(async (mailboxId?: string) => {
    try {
      let query = supabase
        .from('sync_jobs')
        .select('*, sync_state(*)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (mailboxId) {
        query = query.eq('mailbox_id', mailboxId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error('Error fetching sync status:', err);
      return [];
    }
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          error_message: 'Cancelled by user',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error cancelling job:', err);
      return false;
    }
  }, []);

  return {
    status,
    startSync,
    getSyncStatus,
    cancelJob,
  };
}
