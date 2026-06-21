import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  mailboxId?: string;
  onSuccess: (email: string) => void;
}

export default function GmailConnectButton({ mailboxId, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non connecté');

      const redirectUri = `${window.location.origin}/gmail-callback`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-auth-init`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mailbox_id: mailboxId || null, redirect_uri: redirectUri }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Impossible de démarrer l\'authentification Gmail');
      }

      const { auth_url, state } = await res.json();

      // Store state + callback info in sessionStorage for the popup callback
      sessionStorage.setItem('gmail_oauth_state', state);
      sessionStorage.setItem('gmail_oauth_mailbox_id', mailboxId || '');
      sessionStorage.setItem('gmail_oauth_access_token', session.access_token);

      // Open OAuth popup
      const popup = window.open(auth_url, 'gmail_oauth', 'width=500,height=650,left=200,top=100');

      if (!popup) {
        throw new Error('Le navigateur a bloqué la popup. Autorisez les popups pour ce site.');
      }

      // Listen for the callback message from the popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'gmail_oauth_callback') return;

        window.removeEventListener('message', handleMessage);

        const { code, state: returnedState, error: oauthError } = event.data;

        if (oauthError) {
          setError(`Erreur OAuth : ${oauthError}`);
          setLoading(false);
          return;
        }

        if (returnedState !== state) {
          setError('Erreur de sécurité : state invalide');
          setLoading(false);
          return;
        }

        try {
          const callbackRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-auth-callback`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                code,
                state: returnedState,
                redirect_uri: redirectUri,
                mailbox_id: mailboxId || null,
              }),
            }
          );

          if (!callbackRes.ok) {
            const err = await callbackRes.json();
            throw new Error(err.error || 'Échec de l\'échange de tokens');
          }

          const result = await callbackRes.json();
          onSuccess(result.email);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup if popup closed without completing
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
        }
      }, 500);

    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-slate-200 hover:border-red-300 rounded-xl text-sm font-medium text-slate-700 hover:text-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        {loading ? 'Connexion en cours...' : 'Se connecter avec Google'}
      </button>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Vous serez redirigé vers Google pour autoriser l'accès à vos emails. Aucun mot de passe n'est stocké.
      </p>
    </div>
  );
}
