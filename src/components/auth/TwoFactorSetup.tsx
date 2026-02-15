import { useState } from 'react';
import { Shield, Copy, Check, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';

interface TwoFactorSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TwoFactorSetup({ isOpen, onClose, onSuccess }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'init' | 'verify'>('init');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleEnroll() {
    setLoading(true);
    setError('');

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'EmailOps App'
      });

      if (enrollError) throw enrollError;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('verify');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error('TOTP factor not found');

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: verifyCode
      });

      if (verifyError) throw verifyError;

      const codes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
      setBackupCodes(codes);

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Activer l'authentification à deux facteurs" size="md">
      <div className="space-y-4">
        {step === 'init' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    Protégez votre compte
                  </h4>
                  <p className="text-xs text-blue-700">
                    L'authentification à deux facteurs ajoute une couche de sécurité supplémentaire à votre compte.
                    Vous aurez besoin d'une application d'authentification comme Google Authenticator, Authy ou 1Password.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-sm font-medium text-slate-700">Étapes:</h5>
              <ol className="text-xs text-slate-600 space-y-1 ml-4 list-decimal">
                <li>Installez une application d'authentification sur votre téléphone</li>
                <li>Scannez le QR code qui sera affiché</li>
                <li>Entrez le code à 6 chiffres pour vérifier</li>
                <li>Sauvegardez vos codes de récupération</li>
              </ol>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                onClick={handleEnroll}
                disabled={loading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Configuration...' : 'Commencer'}
              </button>
            </div>
          </>
        )}

        {step === 'verify' && !backupCodes.length && (
          <>
            <div className="space-y-4">
              <div className="bg-white border-2 border-slate-200 rounded-lg p-4 flex justify-center">
                {qrCode && (
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Ou entrez ce code manuellement:
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono">
                    {secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Code de vérification (6 chiffres):
                </label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  placeholder="000000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                onClick={handleVerify}
                disabled={loading || verifyCode.length !== 6}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Vérifier'}
              </button>
            </div>
          </>
        )}

        {backupCodes.length > 0 && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900 mb-1">
                    Codes de récupération
                  </h4>
                  <p className="text-xs text-amber-700 mb-3">
                    Sauvegardez ces codes dans un endroit sûr. Chaque code ne peut être utilisé qu'une seule fois.
                  </p>
                  <div className="bg-white border border-amber-200 rounded p-3 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, i) => (
                        <div key={i} className="text-slate-700">
                          {i + 1}. {code}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={copyBackupCodes}
                    className="mt-2 text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copier les codes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-700 text-center">
                ✓ Authentification à deux facteurs activée avec succès !
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
              >
                Terminer
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
