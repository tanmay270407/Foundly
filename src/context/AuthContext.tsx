import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  getFriendlyAuthErrorMessage,
  getUserProfile,
  getConfiguredCollege,
} from '../lib/supabase';
import { Profile, ConfiguredCollege, NormalizedRole, normalizeRole } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: NormalizedRole | null;
  collegeId: string | null;
  configuredCollege: ConfiguredCollege | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: NormalizedRole }>;
  signInAdmin: (email: string, password: string) => Promise<{ error: string | null; role?: NormalizedRole }>;
  signUp: (fullName: string, email: string, password: string, collegeId?: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  refreshCollege: () => Promise<ConfiguredCollege | null>;
}

const LOCAL_ADMIN_SESSION_KEY = 'foundly_local_admin_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [configuredCollege, setConfiguredCollege] = useState<ConfiguredCollege | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  // Prevents onAuthStateChange from flashing an unresolved null profile while signIn / signInAdmin already fetched it
  const preloadedProfileRef = useRef<{ userId: string; profile: Profile } | null>(null);
  const authRequestSeqRef = useRef<number>(0);

  const refreshCollege = useCallback(async (): Promise<ConfiguredCollege | null> => {
    const { data } = await getConfiguredCollege();
    setConfiguredCollege(data);
    return data;
  }, []);

  /**
   * Fetches the user's profile from Supabase. If a newly confirmed student signs in
   * for the very first time and their profile row does not exist yet (because email
   * confirmation deferred session creation during signUp), auto-bootstraps their student profile.
   */
  const fetchOrBootstrapProfile = useCallback(
    async (authUser: User): Promise<Profile | null> => {
      if (!isConfigured || !authUser?.id) return null;

      if (preloadedProfileRef.current?.userId === authUser.id) {
        return preloadedProfileRef.current.profile;
      }

      const { data, error } = await getUserProfile(authUser.id);
      if (data) {
        return data;
      }

      if (error) {
        console.warn('[Auth] Could not load profile from Supabase:', error);
      }

      // Auto-bootstrap missing student profile after confirmed signup
      const metaRole = String(authUser.user_metadata?.role || 'student').toLowerCase();
      if (metaRole !== 'student') {
        return null;
      }

      let targetCollegeId = String(authUser.user_metadata?.college_id || '').trim();
      if (!targetCollegeId) {
        const latest = await getConfiguredCollege();
        targetCollegeId = latest.data?.id || '';
      }

      if (!targetCollegeId) return null;

      const fullName =
        String(authUser.user_metadata?.full_name || '').trim() ||
        (authUser.email ? authUser.email.split('@')[0] : 'Campus Student');

      const { data: created, error: upsertErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: authUser.id,
            full_name: fullName,
            email: (authUser.email || '').toLowerCase(),
            college_id: targetCollegeId,
            role: 'student',
          },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle();

      if (upsertErr) {
        console.warn('[Auth] Auto-bootstrap profile failed:', upsertErr.message);
        return null;
      }

      return (created as Profile) || null;
    },
    [isConfigured]
  );

  useEffect(() => {
    refreshCollege();
  }, [refreshCollege]);

  useEffect(() => {
    if (!isConfigured) {
      try {
        const stored = sessionStorage.getItem(LOCAL_ADMIN_SESSION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Profile;
          setProfile(parsed);
          setUser({ id: parsed.id, email: parsed.email } as User);
        }
      } catch {
        // ignore storage errors
      }
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Atomically apply session + user + profile together so Navbar/ProtectedRoute NEVER flash wrong role
    const applyAuthSession = async (nextSession: Session | null) => {
      const reqId = ++authRequestSeqRef.current;

      if (!nextSession?.user) {
        if (isMounted && reqId === authRequestSeqRef.current) {
          preloadedProfileRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
        return;
      }

      // If restored session JWT is already expired or expiring within 15s, refresh before running queries
      let activeSession = nextSession;
      const nowSec = Math.floor(Date.now() / 1000);
      if (activeSession.expires_at && activeSession.expires_at <= nowSec + 15) {
        try {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (!isMounted || reqId !== authRequestSeqRef.current) return;

          if (refreshed?.session?.user) {
            activeSession = refreshed.session;
          } else if (refreshErr) {
            const msg = String(refreshErr.message || '').toLowerCase();
            const isNetwork =
              msg.includes('failed to fetch') ||
              msg.includes('network') ||
              msg.includes('load failed');
            if (!isNetwork) {
              // Refresh token is expired/invalid; clear stale session cleanly
              await supabase.auth.signOut().catch(() => {});
              preloadedProfileRef.current = null;
              setSession(null);
              setUser(null);
              setProfile(null);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // Ignore transient network errors during refresh check
        }
      }

      const preloaded =
        preloadedProfileRef.current?.userId === activeSession.user.id
          ? preloadedProfileRef.current.profile
          : null;

      if (preloaded) {
        if (isMounted && reqId === authRequestSeqRef.current) {
          setSession(activeSession);
          setUser(activeSession.user);
          setProfile(preloaded);
          setIsLoading(false);
        }
        return;
      }

      // Resolve profile BEFORE setting user so role is known immediately on render
      if (isMounted) setIsLoading(true);
      const resolvedProfile = await fetchOrBootstrapProfile(activeSession.user);

      if (!isMounted || reqId !== authRequestSeqRef.current) return;

      // Block retired foundly_owner sessions automatically
      if (resolvedProfile && normalizeRole(resolvedProfile.role) === 'retired_owner') {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setSession(activeSession);
      setUser(activeSession.user);
      setProfile(resolvedProfile);
      setIsLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        applyAuthSession(initialSession);
      })
      .catch((err) => {
        console.warn('[Auth] Error getting initial session:', err);
        if (isMounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applyAuthSession(newSession);
    });

    // Proactively refresh expiring JWT when user returns to tab or regains connectivity
    const handleVisibilityOrOnline = async () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        const nowSec = Math.floor(Date.now() / 1000);
        if (currentSession?.expires_at && currentSession.expires_at <= nowSec + 60) {
          await supabase.auth.refreshSession();
        }
      } catch {
        // Ignore transient network issues on resume
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
    };
  }, [isConfigured, fetchOrBootstrapProfile]);

  const role = profile ? normalizeRole(profile.role) : null;
  const collegeId = profile?.college_id ?? configuredCollege?.id ?? null;

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; role?: NormalizedRole }> => {
    if (!isConfigured) {
      return {
        error:
          'Supabase connection is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { error: getFriendlyAuthErrorMessage(error) };
      }

      if (!data.user || !data.session) {
        return { error: 'Unable to authenticate. Please check your credentials.' };
      }

      const userProfile = await fetchOrBootstrapProfile(data.user);
      const resolvedRole = userProfile ? normalizeRole(userProfile.role) : 'student';

      if (resolvedRole === 'retired_owner') {
        await supabase.auth.signOut();
        preloadedProfileRef.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
        return {
          error:
            'The Owner Portal has been discontinued. Former Owner accounts cannot sign in unless explicitly assigned a College Admin role.',
        };
      }

      if (userProfile) {
        preloadedProfileRef.current = { userId: data.user.id, profile: userProfile };
      }
      setProfile(userProfile);
      setUser(data.user);
      setSession(data.session);
      setIsLoading(false);

      return { error: null, role: resolvedRole };
    } catch (err: any) {
      console.error('[Auth] Sign in network exception:', err);
      return { error: getFriendlyAuthErrorMessage(err) };
    }
  };

  const signInAdmin = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; role?: NormalizedRole }> => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        return { error: data.error || 'Invalid College Admin email or password.' };
      }

      if (data.mode === 'supabase' && data.session?.access_token && data.session?.refresh_token) {
        // Seed verified admin profile BEFORE setSession so onAuthStateChange commits college_admin immediately (zero flash!)
        if (data.profile?.id) {
          preloadedProfileRef.current = {
            userId: data.profile.id,
            profile: data.profile as Profile,
          };
        }

        const { data: setData, error: setErr } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (setErr || !setData.user) {
          preloadedProfileRef.current = null;
          return { error: getFriendlyAuthErrorMessage(setErr) };
        }

        const userProfile = (data.profile as Profile) || (await fetchOrBootstrapProfile(setData.user));
        if (userProfile) {
          preloadedProfileRef.current = { userId: setData.user.id, profile: userProfile };
        }
        setProfile(userProfile);
        setUser(setData.user);
        setSession(setData.session);
        setIsLoading(false);
        return { error: null, role: 'college_admin' };
      }

      if (data.mode === 'local_admin' && data.admin) {
        const adminProfile: Profile = data.admin;
        try {
          sessionStorage.setItem(LOCAL_ADMIN_SESSION_KEY, JSON.stringify(adminProfile));
        } catch {
          // ignore storage errors
        }
        preloadedProfileRef.current = { userId: adminProfile.id, profile: adminProfile };
        setProfile(adminProfile);
        setUser({ id: adminProfile.id, email: adminProfile.email } as User);
        setSession(null);
        setIsLoading(false);
        return { error: null, role: 'college_admin' };
      }

      return { error: 'Could not establish administrator session.' };
    } catch (err: any) {
      console.error('[Auth] Admin sign in exception:', err);
      return { error: getFriendlyAuthErrorMessage(err) };
    }
  };

  const signUp = async (
    fullName: string,
    email: string,
    password: string,
    explicitCollegeId?: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    if (!isConfigured) {
      return {
        error:
          'Supabase connection is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    try {
      let targetCollegeId = explicitCollegeId || configuredCollege?.id || '';
      if (!targetCollegeId) {
        const latestCollege = await refreshCollege();
        targetCollegeId = latestCollege?.id || '';
      }

      if (!targetCollegeId) {
        return {
          error: 'Campus configuration is not initialized yet. Please contact your College Administrator.',
        };
      }

      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            college_id: targetCollegeId,
            role: 'student',
          },
        },
      });

      if (authError) {
        return { error: getFriendlyAuthErrorMessage(authError) };
      }

      const createdUser = authData.user;
      if (!createdUser) {
        return { error: 'Registration could not be completed. Please try again.' };
      }

      // Supabase returns identities: [] when an email is already registered (if email confirmation is enabled)
      if (Array.isArray(createdUser.identities) && createdUser.identities.length === 0) {
        return { error: 'An account with this email already exists. Please log in.' };
      }

      const needsEmailConfirmation = !authData.session;

      // Only write profile & activity log directly when an authenticated session exists (RLS requires auth.uid() = id).
      // If email confirmation is required, fetchOrBootstrapProfile() automatically creates the student profile on first login.
      if (authData.session) {
        const { data: createdProfile, error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: createdUser.id,
              full_name: trimmedName,
              email: normalizedEmail,
              college_id: targetCollegeId,
              role: 'student',
            },
            { onConflict: 'id' }
          )
          .select('*')
          .maybeSingle();

        if (profileError) {
          console.error('[Auth] Profile creation failed after signup:', profileError);
          return {
            error:
              'Account created, but profile setup failed. Please try signing in or contact your college administrator.',
          };
        }

        try {
          await supabase.from('activity_logs').insert({
            college_id: targetCollegeId,
            actor_id: createdUser.id,
            action: 'STUDENT_ONBOARDED',
            entity_type: 'PROFILE',
            entity_id: createdUser.id,
            metadata: { full_name: trimmedName, email: normalizedEmail },
          });
        } catch (logErr) {
          console.warn('[Auth] Onboarding activity log skipped:', logErr);
        }

        const resolvedProf = (createdProfile as Profile) || (await fetchOrBootstrapProfile(createdUser));
        if (resolvedProf) {
          preloadedProfileRef.current = { userId: createdUser.id, profile: resolvedProf };
        }
        setProfile(resolvedProf);
        setUser(createdUser);
        setSession(authData.session);
        setIsLoading(false);
      }

      return { error: null, needsEmailConfirmation };
    } catch (err: any) {
      console.error('[Auth] Sign up network exception:', err);
      return { error: getFriendlyAuthErrorMessage(err) };
    }
  };

  const signOut = async (): Promise<void> => {
    preloadedProfileRef.current = null;
    try {
      sessionStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
    } catch {
      // ignore storage errors
    }
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('[Auth] Error during signOut:', err);
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsLoading(false);
  };

  const refreshProfile = async (): Promise<Profile | null> => {
    if (!user) return null;
    preloadedProfileRef.current = null;
    const prof = await fetchOrBootstrapProfile(user);
    if (prof) {
      preloadedProfileRef.current = { userId: user.id, profile: prof };
    }
    setProfile(prof);
    return prof;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        collegeId,
        configuredCollege,
        isLoading,
        isConfigured,
        signIn,
        signInAdmin,
        signUp,
        signOut,
        refreshProfile,
        refreshCollege,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
