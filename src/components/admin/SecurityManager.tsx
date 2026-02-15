import { useEffect, useState } from 'react';
import { Shield, Key, AlertTriangle, Activity, Lock, Unlock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TwoFactorSetup from '../auth/TwoFactorSetup';

export default function SecurityManager() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [rateLimitStats, setRateLimitStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      setMfaEnabled(factors.data?.totp?.some((f: any) => f.status === 'verified') || false);

      const { data: events } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (events) setSecurityEvents(events);

      const { data: rateLimits } = await supabase
        .from('rate_limit_tracker')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (rateLimits) setRateLimitStats(rateLimits);
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisableMfa() {
    if (!confirm('Êtes-vous sûr de vouloir désactiver l\'authentification à deux facteurs ?')) {
      return;
    }

    try {
      const factors = await supabase.auth.mfa.listFactors();
      const totpFactor = factors.data?.totp?.[0];

      if (totpFactor) {
        await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
        setMfaEnabled(false);
      }
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  }

  function getRiskScoreColor(score: number) {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-amber-600 bg-amber-100';
    return 'text-green-600 bg-green-100';
  }

  function getActionLabel(action: string) {
    const labels: Record<string, string> = {
      login_success: 'Connexion réussie',
      login_failed: 'Échec de connexion',
      logout: 'Déconnexion',
      password_changed: 'Mot de passe modifié',
      email_changed: 'Email modifié',
      mfa_enabled: '2FA activé',
      mfa_disabled: '2FA désactivé',
      role_changed: 'Rôle modifié',
      credential_accessed: 'Accès aux credentials',
      credential_decrypted: 'Déchiffrement credentials',
      data_exported: 'Export de données',
      mailbox_deleted: 'Boîte mail supprimée',
      user_deleted: 'Utilisateur supprimé'
    };
    return labels[action] || action;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Sécurité du compte</h3>
        <p className="text-sm text-slate-500">Gérez les paramètres de sécurité avancés</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Authentification à deux facteurs (2FA)
          </h4>
        </div>
        <div className="p-6">
          {mfaEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">2FA activé</p>
                  <p className="text-xs text-slate-500">Votre compte est protégé par l'authentification à deux facteurs</p>
                </div>
              </div>
              <button
                onClick={handleDisableMfa}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition"
              >
                Désactiver
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Unlock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">2FA désactivé</p>
                  <p className="text-xs text-slate-500">Ajoutez une couche de sécurité supplémentaire à votre compte</p>
                </div>
              </div>
              <button
                onClick={() => setMfaSetupOpen(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
              >
                Activer
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Événements de sécurité récents
          </h4>
        </div>
        <div className="divide-y divide-slate-100">
          {securityEvents.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Aucun événement de sécurité
            </div>
          ) : (
            securityEvents.map((event) => (
              <div key={event.id} className="px-6 py-3 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {getActionLabel(event.action)}
                      </p>
                      {event.risk_score > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskScoreColor(event.risk_score)}`}>
                          Risque: {event.risk_score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {event.user_email && (
                        <p className="text-xs text-slate-500">{event.user_email}</p>
                      )}
                      {event.ip_address && (
                        <p className="text-xs text-slate-400">IP: {event.ip_address}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {new Date(event.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  {event.risk_score >= 70 && (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4" />
            Rate Limiting
          </h4>
        </div>
        <div className="divide-y divide-slate-100">
          {rateLimitStats.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Aucune limite de taux active
            </div>
          ) : (
            rateLimitStats.map((stat) => (
              <div key={stat.id} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{stat.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Identifiant: {stat.identifier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {stat.attempt_count} tentatives
                    </p>
                    {stat.blocked_until && new Date(stat.blocked_until) > new Date() && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Bloqué jusqu'à {new Date(stat.blocked_until).toLocaleTimeString('fr-FR')}
                      </p>
                    )}
                    {stat.violation_count > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        {stat.violation_count} violations
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Bonnes pratiques de sécurité
        </h4>
        <ul className="text-xs text-blue-700 space-y-1.5 ml-4 list-disc">
          <li>Activez l'authentification à deux facteurs pour tous les comptes administrateurs</li>
          <li>Utilisez des mots de passe forts et uniques (minimum 12 caractères)</li>
          <li>Ne partagez jamais vos identifiants de connexion</li>
          <li>Vérifiez régulièrement les événements de sécurité suspects</li>
          <li>Maintenez vos applications d'authentification à jour</li>
        </ul>
      </div>

      <TwoFactorSetup
        isOpen={mfaSetupOpen}
        onClose={() => setMfaSetupOpen(false)}
        onSuccess={() => {
          setMfaSetupOpen(false);
          load();
        }}
      />
    </div>
  );
}
