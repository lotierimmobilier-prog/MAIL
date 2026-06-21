import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function GmailCallbackPage() {
  const [params] = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'gmail_oauth_callback', code, state, error },
        window.location.origin
      );
      window.close();
    }
  }, [params]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#334155', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '2rem', height: '2rem', border: '3px solid #e2e8f0', borderTopColor: '#0891b2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p>Finalisation de la connexion Gmail...</p>
      </div>
    </div>
  );
}
