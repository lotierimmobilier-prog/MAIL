import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface MailboxPermission {
  mailbox_id: string;
  can_read: boolean;
  can_send: boolean;
  can_manage: boolean;
}

export function useMailboxPermissions() {
  const { user, isAdmin, isManager, userRole } = useAuth();
  const [permissions, setPermissions] = useState<MailboxPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      if (isAdmin || isManager) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('mailbox_permissions')
        .select('mailbox_id, can_read, can_send, can_manage')
        .eq('user_id', user!.id);

      setPermissions(data || []);
      setLoading(false);
    }

    load();
  }, [user, userRole]);

  function canReadMailbox(mailboxId: string): boolean {
    if (isAdmin || isManager) return true;
    return permissions.some(p => p.mailbox_id === mailboxId && p.can_read);
  }

  function canSendMailbox(mailboxId: string): boolean {
    if (isAdmin || isManager) return true;
    return permissions.some(p => p.mailbox_id === mailboxId && p.can_send);
  }

  function canManageMailbox(mailboxId: string): boolean {
    if (isAdmin || isManager) return true;
    return permissions.some(p => p.mailbox_id === mailboxId && p.can_manage);
  }

  function getReadableMailboxIds(): Set<string> | null {
    if (isAdmin || isManager) return null;
    return new Set(permissions.filter(p => p.can_read).map(p => p.mailbox_id));
  }

  function getSendableMailboxIds(): Set<string> | null {
    if (isAdmin || isManager) return null;
    return new Set(permissions.filter(p => p.can_send).map(p => p.mailbox_id));
  }

  return {
    permissions,
    loading,
    canReadMailbox,
    canSendMailbox,
    canManageMailbox,
    getReadableMailboxIds,
    getSendableMailboxIds,
  };
}
