import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfiguredCollege, Profile } from '../types';

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const envSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    envSupabaseUrl &&
      envSupabaseAnonKey &&
      envSupabaseUrl.startsWith('http') &&
      !envSupabaseUrl.includes('YOUR_') &&
      !envSupabaseUrl.includes('placeholder')
  );
}

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
    avatars: 'avatars',
  },
  tables: {
    appConfig: 'app_config',
    colleges: 'colleges',
    profiles: 'profiles',
    items: 'items',
    claims: 'claims',
    notifications: 'notifications',
    activityLogs: 'activity_logs',
  },
};

export function getStoragePath(collegeId: string, userId: string, fileName: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  return `${collegeId}/${userId}/${timestamp}-${sanitizedName}`;
}

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

  return message || 'Unable to complete request. Please verify your information and try again.';
}

export const DEFAULT_OFFICE_CONFIG = {
  office_name: 'Galgotias University Lost & Found Office',
  office_location: 'Block A, Ground Floor, Campus Security & Student Welfare Desk, Galgotias University',
  office_hours: 'Monday – Saturday, 9:00 AM – 5:00 PM',
  contact_email: 'lostandfound@galgotiasuniversity.edu.in',
  contact_phone: '+91-120-4370000',
  pickup_instructions:
    'Bring your valid Galgotias University Student ID card and claim reference ID to verify ownership before collecting approved items.',
};

/**
 * Loads the single configured college from backend `/api/public/college`
 * with direct Supabase `app_config` / `colleges` fallback.
 */
export async function getConfiguredCollege(): Promise<{
  data: ConfiguredCollege | null;
  configured: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch('/api/public/college');
    if (res.ok) {
      const json = await res.json();
      if (json.college) {
        return { data: json.college as ConfiguredCollege, configured: Boolean(json.configured), error: null };
      }
      if (json.supabaseReady === false) {
        return { data: null, configured: false, error: 'SUPABASE_NOT_CONFIGURED' };
      }
    }
  } catch {
    // Fallback to direct Supabase query below
  }

  if (!isSupabaseConfigured()) {
    return { data: null, configured: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }

  try {
    const { data: configRow } = await supabase
      .from('app_config')
      .select('*, colleges(*)')
      .eq('id', 1)
      .maybeSingle();

    if (configRow && configRow.colleges) {
      const col = Array.isArray(configRow.colleges) ? configRow.colleges[0] : configRow.colleges;
      if (col) {
        return {
          configured: true,
          error: null,
          data: {
            id: col.id,
            name: col.name,
            code: col.code,
            city: col.city || null,
            state: col.state || null,
            office_name: configRow.office_name || DEFAULT_OFFICE_CONFIG.office_name,
            office_location: configRow.office_location || DEFAULT_OFFICE_CONFIG.office_location,
            office_hours: configRow.office_hours || DEFAULT_OFFICE_CONFIG.office_hours,
            contact_email: configRow.contact_email || DEFAULT_OFFICE_CONFIG.contact_email,
            contact_phone: configRow.contact_phone || '',
            pickup_instructions: configRow.pickup_instructions || DEFAULT_OFFICE_CONFIG.pickup_instructions,
          },
        };
      }
    }

    const { data: colData, error: colErr } = await supabase
      .from('colleges')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (colErr) {
      return { data: null, configured: true, error: colErr.message };
    }

    if (!colData) {
      return { data: null, configured: true, error: null };
    }

    return {
      configured: true,
      error: null,
      data: {
        id: colData.id,
        name: colData.name,
        code: colData.code,
        city: colData.city || null,
        state: colData.state || null,
        ...DEFAULT_OFFICE_CONFIG,
      },
    };
  } catch (err: any) {
    return { data: null, configured: true, error: err?.message || 'Network error' };
  }
}

export async function getUserProfile(userId: string): Promise<{ data: Profile | null; error: string | null }> {
  if (!isSupabaseConfigured() || !userId) {
    return { data: null, error: 'SUPABASE_NOT_CONFIGURED' };
  }

  try {
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error && String(error.message || '').toLowerCase().includes('jwt expired')) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed.session) {
        const retry = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.warn('[Supabase] Could not fetch profile:', error.message);
      return { data: null, error: error.message };
    }

    return { data: data as Profile | null, error: null };
  } catch (err: any) {
    console.warn('[Supabase] Network exception fetching profile:', err?.message || err);
    return { data: null, error: err?.message || 'Network error' };
  }
}

/**
 * Extracts the missing column name from PostgREST (PGRST204) or PostgreSQL (42703) schema errors.
 */
export function extractMissingColumn(err: any): string | null {
  if (!err) return null;
  const msg = String(typeof err === 'string' ? err : err.message || '');
  // PostgREST schema cache error: "Could not find the 'storage_location' column of 'items' in the schema cache"
  const pgrstMatch = msg.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  // Postgres direct error: 'column "storage_location" of relation "items" does not exist'
  const pgMatch = msg.match(
    /column\s+(?:[a-z0-9_]+\.)?['"]?([a-z0-9_]+)['"]?\s+(?:of relation\s+[^\s]+\s+)?does not exist/i
  );
  if (pgMatch?.[1]) return pgMatch[1];
  return null;
}

/**
 * Inserts a row into a Supabase table, automatically pruning any optional columns
 * that do not exist in the live database schema cache (PGRST204 / 42703) and retrying.
 */
export async function safeInsert<T = any>(
  table: string,
  initialPayload: Record<string, any>,
  options?: { select?: string; single?: boolean }
): Promise<{ data: T | null; error: any; droppedColumns: string[] }> {
  const payload = { ...initialPayload };
  const droppedColumns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    let query: any = supabase.from(table).insert(payload);
    if (options?.select) {
      query = query.select(options.select);
    }
    if (options?.single) {
      query = query.single();
    }

    const { data, error } = await query;
    if (!error) {
      return { data: (data ?? null) as T | null, error: null, droppedColumns };
    }

    const missingCol = extractMissingColumn(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
      console.warn(`[Supabase] Pruning unavailable column "${missingCol}" during insert into "${table}"`);
      delete payload[missingCol];
      droppedColumns.push(missingCol);
      continue;
    }

    return { data: null, error, droppedColumns };
  }

  return {
    data: null,
    error: { message: `Too many schema mismatches while inserting into ${table}.` },
    droppedColumns,
  };
}

/**
 * Updates rows in a Supabase table, automatically pruning any optional columns
 * that do not exist in the live database schema cache (PGRST204 / 42703) and retrying.
 */
export async function safeUpdate<T = any>(
  table: string,
  matchColumn: string,
  matchValue: string | number,
  initialPayload: Record<string, any>,
  options?: { select?: string; single?: boolean }
): Promise<{ data: T | null; error: any; droppedColumns: string[] }> {
  const payload = { ...initialPayload };
  const droppedColumns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    if (Object.keys(payload).length === 0) {
      return { data: null, error: null, droppedColumns };
    }

    let query: any = supabase.from(table).update(payload).eq(matchColumn, matchValue);
    if (options?.select) {
      query = query.select(options.select);
    }
    if (options?.single) {
      query = query.single();
    }

    const { data, error } = await query;
    if (!error) {
      return { data: (data ?? null) as T | null, error: null, droppedColumns };
    }

    const missingCol = extractMissingColumn(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
      console.warn(`[Supabase] Pruning unavailable column "${missingCol}" during update on "${table}"`);
      delete payload[missingCol];
      droppedColumns.push(missingCol);
      continue;
    }

    return { data: null, error, droppedColumns };
  }

  return {
    data: null,
    error: { message: `Too many schema mismatches while updating ${table}.` },
    droppedColumns,
  };
}

