import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { UserRole } from '../lib/types';

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  isAdmin: boolean;
  isManager: boolean;
  canManage: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserRole(null);
        setLoading(false);
      } else if (session) {
        setSession(session);
        setUser(session.user);
        loadUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        setUserRole('agent');
        setLoading(false);
        return;
      }

      if (profile) {
        if (profile.is_active === false) {
          await supabase.auth.signOut();
          setUserRole(null);
          setUser(null);
          setSession(null);
        } else {
          setUserRole(profile.role as UserRole);
        }
      } else {
        setUserRole('agent');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setUserRole('agent');
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile?.is_active) {
          await supabase.auth.signOut();
          return { error: 'Votre compte est désactivé. Contactez un administrateur.' };
        }
      }

      return { error: null };
    } catch (err) {
      return { error: 'Erreur de connexion. Veuillez réessayer.' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  }

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || isAdmin;
  const canManage = isManager || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        authenticated: !!user,
        loading,
        user,
        session,
        userRole,
        isAdmin,
        isManager,
        canManage,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
