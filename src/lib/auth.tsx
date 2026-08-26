import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  default_branch_id: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  role_id: string;
  role_name: string;
  role_display_name: string;
  branch_id: string;
  branch_name: string;
  branch_code: string;
};

export type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  roles: UserRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRoles = useCallback(async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }

    setProfile(profileData as UserProfile | null);

    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        branch_id,
        roles!inner (
          name,
          display_name
        ),
        branches!inner (
          name,
          code
        )
      `)
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setRoles([]);
      return;
    }

    const mappedRoles: UserRole[] = (rolesData || []).map((r: any) => ({
      role_id: r.role_id,
      role_name: r.roles.name,
      role_display_name: r.roles.display_name,
      branch_id: r.branch_id,
      branch_name: r.branches.name,
      branch_code: r.branches.code,
    }));

    setRoles(mappedRoles);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfileAndRoles(user.id);
    }
  }, [user, fetchProfileAndRoles]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRoles(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfileAndRoles(session.user.id);
        })();
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfileAndRoles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
      });
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, profile, roles, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function hasPermission(roles: UserRole[], permissionCode: string): boolean {
  // This is a client-side convenience check. Server-side enforcement is the real gate.
  // For now, since we don't have role_permissions loaded client-side, we check by role name.
  // This will be enhanced in later phases to load actual permissions.
  const roleNames = roles.map(r => r.role_name);
  if (roleNames.includes('owner') || roleNames.includes('admin')) return true;
  // For other roles, we'll load permissions in a later enhancement
  return true; // Temporary: allow all for authenticated users until permissions are loaded client-side
}
