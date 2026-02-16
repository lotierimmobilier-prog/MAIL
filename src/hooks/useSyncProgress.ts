import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SyncProgress {
  isSyncing: boolean;
  progress: number;
  mailboxName: string | null;
  totalEmails: number;
  syncedEmails: number;
}

export function useSyncProgress() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isSyncing: false,
    progress: 0,
    mailboxName: null,
    totalEmails: 0,
    syncedEmails: 0,
  });

  useEffect(() => {
    const checkSyncState = async () => {
      const { data: syncStates } = await supabase
        .from('sync_state')
        .select(`
          *,
          mailboxes (
            name
          )
        `)
        .eq('is_syncing', true)
        .limit(1)
        .maybeSingle();

      if (syncStates) {
        const totalEmails = syncStates.last_sequence_number || syncStates.last_uid || 100;
        const syncedEmails = syncStates.total_emails_synced || 0;
        const progress = totalEmails > 0 ? Math.min(Math.round((syncedEmails / totalEmails) * 100), 99) : 0;

        setSyncProgress({
          isSyncing: true,
          progress,
          mailboxName: (syncStates.mailboxes as any)?.name || null,
          totalEmails,
          syncedEmails,
        });
      } else {
        setSyncProgress({
          isSyncing: false,
          progress: 0,
          mailboxName: null,
          totalEmails: 0,
          syncedEmails: 0,
        });
      }
    };

    checkSyncState();

    const subscription = supabase
      .channel('sync_state_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_state',
        },
        () => {
          checkSyncState();
        }
      )
      .subscribe();

    const interval = setInterval(checkSyncState, 3000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return syncProgress;
}
