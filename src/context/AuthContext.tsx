import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, additionalData?: any) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchProfileWithRetry = async (userId: string, retries = 3): Promise<Profile | null> => {
    let profile: Profile | null = null;
    for (let i = 0; i < retries; i++) {
      profile = await fetchProfile(userId);
      if (profile) return profile;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id).then(async p => {
          // التحقق الصارم: إذا لم يكن مفعلاً، قم بتسجيل الخروج فوراً
          if (p && !p.enabled && p.role !== 'admin') {
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        (async () => {
          const p = await fetchProfileWithRetry(session.user.id, 3);
          if (p && !p.enabled && p.role !== 'admin') {
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { data: rejected } = await supabase.rpc('is_rejected_email', { p_email: email });
      if (rejected === true) {
        return { error: 'تم رفض طلب إنشاء حسابك من الإدارة، ولا يمكن استخدام هذا الحساب.' };
      }
      return { error: error.message };
    }
    if (data.user) {
      const p = await fetchProfileWithRetry(data.user.id, 3);
      
      // الفحص الأهم: منع تسجيل الدخول إذا كان الحساب غير مفعل
      if (p && !p.enabled && p.role !== 'admin') {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return { error: 'حسابك بانتظار مراجعة وتفعيل الإدارة. لا يمكنك الدخول حالياً.' };
      }
      
      setProfile(p);
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, additionalData?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: fullName,
          ...additionalData
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    // الحسابات الجديدة تكون معلقة من قاعدة البيانات، ويُسجل الخروج منها فورًا.
    if (data.user) {
      await supabase.auth.signOut();
    }

    return { error: 'تم إنشاء الحساب بنجاح وهو الآن بانتظار موافقة الإدارة لتسجيل الدخول.' };
  };

  const refreshProfile = async () => {
    if (!session?.user.id) return;
    const nextProfile = await fetchProfile(session.user.id);
    setProfile(nextProfile);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getDashboardRoute(role: UserRole): string {
  switch (role) {
    case 'admin': return 'admin';
    case 'employee': return 'employee';
    case 'client': return 'client';
    case 'default': return 'client';
  }
}