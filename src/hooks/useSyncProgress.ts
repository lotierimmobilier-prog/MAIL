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
        const syncedEmails = syncStates.total_emails_synced || 0;
        const lastUid = syncStates.last_uid || 0;
        const lastSeq = syncStates.last_sequence_number || 0;
        const totalEmails = Math.max(lastSeq, lastUid, syncedEmails + 1);
        const progress = totalEmails > 0 ? Math.min(Math.round((syncedEmails / totalEmails) * 100), 99) : 0;

        setSyncProgress({
          isSyncing: true,
          progress,
          mailboxName: (syncStates.mailboxes as any)?.name || null,
          totalEmails,
          syncedEmails,
        });
      } else {
        setSyncProgress(prev => {
          if (!prev.isSyncing) return prev;
          return {
            isSyncing: false,
            progress: 0,
            mailboxName: null,
            totalEmails: 0,
            syncedEmails: 0,
          };
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

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return syncProgress;
}
