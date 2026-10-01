import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { College, Profile } from '../types';

// Retrieve credentials safely from Vite environment
const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const envSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

/**
 * Checks if Supabase credentials are configured in the current environment
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    envSupabaseUrl &&
    envSupabaseAnonKey &&
    envSupabaseUrl.startsWith('http') &&
    !envSupabaseUrl.includes('YOUR_') &&
    !envSupabaseUrl.includes('placeholder')
  );
}

// Fallback dummy URL to prevent createClient from crashing during module evaluation if env vars are missing
const clientUrl = isSupabaseConfigured() ? envSupabaseUrl : 'https://placeholder-project.supabase.co';
const clientKey = isSupabaseConfigured() ? envSupabaseAnonKey : 'placeholder-anon-key-00000000000000000000000000000000';

export const supabase: SupabaseClient = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_CONFIG = {
  url: envSupabaseUrl,
  anonKey: envSupabaseAnonKey,
  storageBuckets: {
    itemImages: 'item-images',
    claimProofs: 'claim-proofs',
    adminVerification: 'admin-verification',
    avatars: 'avatars',
  },
  tables: {
    colleges: 'colleges',
    profiles: 'profiles',
    items: 'items',
    claims: 'claims',
    adminRequests: 'admin_requests',
    notifications: 'notifications',
    activityLogs: 'activity_logs',
  },
};

/**
 * Storage Path Generator for Multi-College Architecture
 * Files are partitioned by college_id to align with RLS security policies
 */
export function getStoragePath(bucket: string, collegeId: string, fileName: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  return `${collegeId}/${timestamp}-${sanitizedName}`;
}

/**
 * Translates technical Supabase / PostgREST errors into clean, friendly user-facing messages
 */
export function getFriendlyAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const message = typeof error === 'string' ? error : error.message || '';
  const lower = message.toLowerCase();

  if (!isSupabaseConfigured()) {
    return 'Supabase connection is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'Invalid email or password.';
  }
  if (lower.includes('user already registered') || lower.includes('email already in use')) {
    return 'An account with this email already exists. Please log in.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please check your email inbox to verify your account.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return 'Network connection error. Please check your connection and try again.';
  }
  if (lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }

  return 'Unable to complete request. Please verify your information and try again.';
}

/**
 * Loads list of colleges from Supabase `colleges` table
 */
export async function getCollegesFromDb(): Promise<{ data: College[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: 'SUPABASE_NOT_CONFIGURED' };
  }

  try {
    const { data, error } = await supabase
      .from('colleges')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[Supabase] Failed to fetch colleges:', error);
      return { data: [], error: error.message };
    }

    return { data: (data as College[]) || [], error: null };
  } catch (err: any) {
    console.error('[Supabase] Network exception fetching colleges:', err);
    return { data: [], error: err?.message || 'Network error' };
  }
}

/**
 * Loads user profile from Supabase `profiles` table
 */
export async function getUserProfile(userId: string): Promise<{ data: Profile | null; error: string | null }> {
  if (!isSupabaseConfigured() || !userId) {
    return { data: null, error: 'SUPABASE_NOT_CONFIGURED' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Failed to fetch profile:', error);
      return { data: null, error: error.message };
    }

    return { data: data as Profile | null, error: null };
  } catch (err: any) {
    console.error('[Supabase] Network exception fetching profile:', err);
    return { data: null, error: err?.message || 'Network error' };
  }
}
