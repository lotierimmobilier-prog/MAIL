import { useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TwoFactorChallengeProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TwoFactorChallenge({ onSuccess, onCancel }: TwoFactorChallengeProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    if (!code || code.length !== 6) {
      setError('Veuillez entrer un code à 6 chiffres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) {
        throw new Error('2FA non configuré pour ce compte');
      }

      const challenge = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });

      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: code
      });

      if (verify.error) throw verify.error;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6">
            <div className="flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white text-center">
              Authentification à deux facteurs
            </h1>
            <p className="text-cyan-100 text-center text-sm mt-2">
              Entrez le code de votre application d'authentification
            </p>
          </div>

          <form onSubmit={handleVerify} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Code de vérification
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
                maxLength={6}
              />
              <p className="text-xs text-slate-500 mt-2 text-center">
                Le code change toutes les 30 secondes
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 text-center">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Vérification...' : 'Vérifier'}
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
              >
                Annuler
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Vous avez perdu votre appareil ?{' '}
                <button
                  type="button"
                  className="text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Utiliser un code de récupération
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
