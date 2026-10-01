import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage, getUserProfile } from '../lib/supabase';
import { Profile, normalizeRole, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: 'student' | 'college_admin' | 'foundly_owner' | null;
  collegeId: string | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: string }>;
  signUp: (fullName: string, email: string, password: string, collegeId: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  // Fetches latest profile record directly from Supabase profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isConfigured || !userId) return null;
    const { data, error } = await getUserProfile(userId);
    if (error) {
      console.warn('[Auth] Could not load profile from Supabase:', error);
    }
    return data;
  }, [isConfigured]);

  // Initialize and listen to real Supabase auth state
  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Initial session verification
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const prof = await fetchProfile(session.user.id);
        if (isMounted) setProfile(prof);
      }
      if (isMounted) setIsLoading(false);
    }).catch((err) => {
      console.error('[Auth] Error getting initial session:', err);
      if (isMounted) setIsLoading(false);
    });

    // 2. Auth State Change Listener (session updates, sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const prof = await fetchProfile(newSession.user.id);
        if (isMounted) setProfile(prof);
      } else {
        if (isMounted) setProfile(null);
      }
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isConfigured, fetchProfile]);

  // Derived normalized role and college_id from real Supabase profile
  const role = profile ? normalizeRole(profile.role) : null;
  const collegeId = profile?.college_id ?? null;

  // Sign In using real Supabase Auth
  const signIn = async (email: string, password: string): Promise<{ error: string | null; role?: string }> => {
    if (!isConfigured) {
      return { error: 'Supabase connection is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { error: getFriendlyAuthErrorMessage(error) };
      }

      if (!data.user) {
        return { error: 'Unable to authenticate. Please check your credentials.' };
      }

      // Fetch user profile from Supabase to obtain real role and college
      const userProfile = await fetchProfile(data.user.id);
      setProfile(userProfile);
      setUser(data.user);
      setSession(data.session);

      const resolvedRole = userProfile ? normalizeRole(userProfile.role) : 'student';
      return { error: null, role: resolvedRole };
    } catch (err: any) {
      console.error('[Auth] Sign in network exception:', err);
      return { error: getFriendlyAuthErrorMessage(err) };
    }
  };

  // Sign Up using real Supabase Auth & creating profile record
  const signUp = async (
    fullName: string,
    email: string,
    password: string,
    collegeId: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    if (!isConfigured) {
      return { error: 'Supabase connection is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    if (!collegeId) {
      return { error: 'Please select an affiliated college campus.' };
    }

    try {
      // Step 1: Create Supabase Auth Account
      // Note: Normal signups are always restricted to 'student'.
      // Students can NEVER register as college_admin or foundly_owner.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            college_id: collegeId,
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

      // Step 2: Create corresponding profiles record in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: createdUser.id,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          college_id: collegeId,
          role: 'student', // Strictly enforced default student role
        });

      if (profileError) {
        console.error('[Auth] Profile creation failed after signup:', profileError);
        // Meaningful error recovery as instructed in Requirement 10
        return {
          error: 'Account created, but profile setup failed. Please contact your college administrator or try logging in.',
        };
      }

      // Log student onboarding activity
      await supabase
        .from('activity_logs')
        .insert({
          college_id: collegeId,
          actor_id: createdUser.id,
          action: 'STUDENT_ONBOARDED',
          entity_type: 'PROFILE',
          entity_id: createdUser.id,
          metadata: { full_name: fullName.trim(), email: email.trim().toLowerCase() }
        });

      // Check if email confirmation is required by Supabase project settings
      const needsEmailConfirmation = Boolean(
        authData.user && (!authData.session || authData.user.identities?.length === 0)
      );

      // If session exists immediately, fetch profile
      if (authData.session) {
        const userProf = await fetchProfile(createdUser.id);
        setProfile(userProf);
        setUser(createdUser);
        setSession(authData.session);
      }

      return { error: null, needsEmailConfirmation };
    } catch (err: any) {
      console.error('[Auth] Sign up network exception:', err);
      return { error: getFriendlyAuthErrorMessage(err) };
    }
  };

  // Sign Out
  const signOut = async (): Promise<void> => {
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
  };

  // Refresh profile
  const refreshProfile = async (): Promise<Profile | null> => {
    if (!user) return null;
    const prof = await fetchProfile(user.id);
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
        isLoading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        refreshProfile,
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
