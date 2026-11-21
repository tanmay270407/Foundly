import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Configuration
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const configuredCollegeEnvId = (process.env.SINGLE_COLLEGE_ID || '').trim();

const isSupabaseReady = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
);

const publicSupabase: SupabaseClient | null = isSupabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const serviceSupabase: SupabaseClient | null =
  isSupabaseReady && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

// Initialize Gemini Client (v1beta required for structured JSON responseMimeType)
const aiApiKey = (process.env.GEMINI_API_KEY || '').trim();
let ai: GoogleGenAI | null = null;

if (aiApiKey && aiApiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: aiApiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const DEFAULT_OFFICE = {
  office_name: 'Galgotias University Lost & Found Office',
  office_location: 'Block A, Ground Floor, Campus Security & Student Welfare Desk, Galgotias University',
  office_hours: 'Monday – Saturday, 9:00 AM – 5:00 PM',
  contact_email: 'lostandfound@galgotiasuniversity.edu.in',
  contact_phone: '+91-120-4370000',
  pickup_instructions:
    'Bring your valid Galgotias University Student ID card and claim reference ID to verify ownership before collecting approved items.',
};

function createUserScopedClient(token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function getDbClient(userClient?: SupabaseClient): SupabaseClient | null {
  return serviceSupabase || userClient || publicSupabase;
}

function extractMissingColumn(err: any): string | null {
  if (!err) return null;
  const msg = String(err.message || '');
  // PostgREST schema cache error: "Could not find the 'city' column of 'colleges' in the schema cache"
  const pgrstMatch = msg.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  // Postgres direct error: 'column "city" of relation "colleges" does not exist' or 'column colleges.city does not exist'
  const pgMatch = msg.match(
    /column\s+(?:[a-z0-9_]+\.)?['"]?([a-z0-9_]+)['"]?\s+(?:of relation\s+[^\s]+\s+)?does not exist/i
  );
  if (pgMatch?.[1]) return pgMatch[1];
  return null;
}

async function updateWithColumnPruning(
  db: SupabaseClient,
  table: string,
  matchColumn: string,
  matchValue: string | number,
  initialPayload: Record<string, any>
): Promise<{ data: any[] | null; error: any; droppedColumns: string[] }> {
  const payload = { ...initialPayload };
  const droppedColumns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    const keys = Object.keys(payload);
    if (keys.length === 0) {
      return { data: [], error: null, droppedColumns };
    }

    const { data, error } = await db
      .from(table)
      .update(payload)
      .eq(matchColumn, matchValue)
      .select('*');

    if (!error) {
      return { data, error: null, droppedColumns };
    }

    const missingCol = extractMissingColumn(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
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

async function insertWithColumnPruning(
  db: SupabaseClient,
  table: string,
  initialPayload: Record<string, any>
): Promise<{ data: any[] | null; error: any; droppedColumns: string[] }> {
  const payload = { ...initialPayload };
  const droppedColumns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await db.from(table).insert(payload).select('*');
    if (!error) {
      return { data, error: null, droppedColumns };
    }

    const missingCol = extractMissingColumn(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
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

async function getConfiguredCollege(client?: SupabaseClient) {
  const db = client || serviceSupabase || publicSupabase;
  if (!db) {
    return null;
  }

  let collegeId = configuredCollegeEnvId || null;
  let configRow: any = null;

  const { data: appCfg, error: appCfgErr } = await db
    .from('app_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (appCfgErr) {
    console.warn('[getConfiguredCollege] app_config query warning:', appCfgErr.message);
  }

  if (appCfg) {
    configRow = appCfg;
    if (!collegeId && appCfg.college_id) {
      collegeId = appCfg.college_id;
    }
  }

  let collegeRow: any = null;
  if (collegeId) {
    const { data, error } = await db
      .from('colleges')
      .select('*')
      .eq('id', collegeId)
      .maybeSingle();
    if (error) {
      console.warn('[getConfiguredCollege] colleges by id query warning:', error.message);
    }
    collegeRow = data;
  }

  if (!collegeRow) {
    const { data, error } = await db
      .from('colleges')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[getConfiguredCollege] colleges fallback query warning:', error.message);
      const { data: simpleData, error: simpleErr } = await db
        .from('colleges')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (simpleErr) {
        console.warn('[getConfiguredCollege] colleges simple query warning:', simpleErr.message);
      }
      collegeRow = simpleData;
    } else {
      collegeRow = data;
    }
  }

  // If serviceSupabase is configured and no college exists yet, bootstrap Galgotias University automatically
  if (!collegeRow && serviceSupabase) {
    const { data: createdCollege, error: createColErr } = await serviceSupabase
      .from('colleges')
      .insert({ name: 'Galgotias University', code: 'GU' })
      .select('*')
      .single();
    if (!createColErr && createdCollege) {
      await serviceSupabase
        .from('app_config')
        .upsert({ id: 1, college_id: createdCollege.id }, { onConflict: 'id' });
      collegeRow = createdCollege;
    }
  }

  if (!collegeRow) {
    return null;
  }

  return {
    id: collegeRow.id,
    name: collegeRow.name,
    code: collegeRow.code,
    domain: collegeRow.domain || null,
    city: collegeRow.city || null,
    state: collegeRow.state || null,
    office_name: configRow?.office_name || DEFAULT_OFFICE.office_name,
    office_location: configRow?.office_location || DEFAULT_OFFICE.office_location,
    office_hours: configRow?.office_hours || DEFAULT_OFFICE.office_hours,
    contact_email: configRow?.contact_email || DEFAULT_OFFICE.contact_email,
    contact_phone: configRow?.contact_phone || DEFAULT_OFFICE.contact_phone,
    pickup_instructions:
      configRow?.pickup_instructions || DEFAULT_OFFICE.pickup_instructions,
  };
}

// HELPER: Authenticate College Admin (strictly college_admin; retires foundly_owner)
async function authenticateAdmin(req: express.Request) {
  if (!isSupabaseReady) {
    const err: any = new Error('Supabase is not configured on the server.');
    err.statusCode = 503;
    throw err;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err: any = new Error('Unauthorized. Missing authentication token.');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const userClient = createUserScopedClient(token);

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    const err: any = new Error('Unauthorized. Invalid or expired authentication token.');
    err.statusCode = 401;
    throw err;
  }

  const db = getDbClient(userClient)!;
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    const err: any = new Error('User profile not found.');
    err.statusCode = 403;
    throw err;
  }

  const normalizedRole = (profile.role || '').toLowerCase();
  if (normalizedRole === 'foundly_owner') {
    const err: any = new Error(
      'Forbidden. The Foundly Owner role has been discontinued. Please contact a College Admin.'
    );
    err.statusCode = 403;
    throw err;
  }

  if (normalizedRole !== 'college_admin') {
    const err: any = new Error('Forbidden. College Admin access is required.');
    err.statusCode = 403;
    throw err;
  }

  if (profile.is_suspended || String(profile.avatar_url || '').startsWith('[SUSPENDED]')) {
    const err: any = new Error('Forbidden. This administrator account is suspended.');
    err.statusCode = 403;
    throw err;
  }

  const configuredCollege = await getConfiguredCollege(db);
  if (configuredCollege && profile.college_id && profile.college_id !== configuredCollege.id) {
    const err: any = new Error(
      'Forbidden. Administrator profile is not assigned to the configured college.'
    );
    err.statusCode = 403;
    throw err;
  }

  return {
    user,
    profile,
    userClient,
    db,
    collegeId: configuredCollege?.id || profile.college_id,
    configuredCollege,
  };
}

// HELPER: Authenticate any active Student or College Admin user
async function authenticateUser(req: express.Request) {
  if (!isSupabaseReady) {
    const err: any = new Error('Supabase is not configured on the server.');
    err.statusCode = 503;
    throw err;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err: any = new Error('Unauthorized. Missing authentication token.');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const userClient = createUserScopedClient(token);

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    const err: any = new Error('Unauthorized. Invalid or expired authentication token.');
    err.statusCode = 401;
    throw err;
  }

  const db = getDbClient(userClient)!;
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    const err: any = new Error('User profile not found.');
    err.statusCode = 403;
    throw err;
  }

  const normalizedRole = (profile.role || '').toLowerCase();
  if (normalizedRole === 'foundly_owner') {
    const err: any = new Error('Forbidden. The Foundly Owner role has been discontinued.');
    err.statusCode = 403;
    throw err;
  }

  if (profile.is_suspended || String(profile.avatar_url || '').startsWith('[SUSPENDED]')) {
    const err: any = new Error('Forbidden. This account is currently suspended.');
    err.statusCode = 403;
    throw err;
  }

  const configuredCollege = await getConfiguredCollege(db);
  return {
    user,
    profile,
    role: normalizedRole,
    userClient,
    db,
    collegeId: configuredCollege?.id || profile.college_id,
    configuredCollege,
  };
}

function sanitizePublicItem(item: any) {
  if (!item) return null;
  return {
    id: item.id,
    college_id: item.college_id,
    type: (item.type || '').toUpperCase(),
    item_name: item.item_name,
    category: item.category,
    description: item.description,
    brand: item.brand ?? null,
    color: item.color ?? null,
    date: item.date,
    approximate_time: item.approximate_time ?? null,
    location: item.location,
    image_path: item.image_path ?? null,
    status: (item.status || '').toUpperCase(),
    created_at: item.created_at,
  };
}

function extractLinkedLostItemId(claim: any): string | null {
  if (!claim) return null;
  if (typeof claim.lost_item_id === 'string' && claim.lost_item_id.trim()) {
    return claim.lost_item_id.trim();
  }
  const msg = String(claim.additional_message || '');
  const match = msg.match(/\[Linked Lost Report:\s*([0-9a-fA-F-]{36})\]/i);
  return match?.[1] || null;
}

// HELPER: Fetch public images as base64 for Gemini multimodal matching (8s timeout)
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return {
      mimeType,
      data: buffer.toString('base64'),
    };
  } catch (err) {
    console.warn('[Base64 Fetch] Skipped image:', url);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =========================================================================
// RETIRED OWNER & ADMIN APPLICATION ENDPOINTS (Explicit 404)
// =========================================================================
app.all(/^\/api\/owner(\/.*)?$/, (_req, res) => {
  return res.status(404).json({
    error: 'The Foundly Owner Portal API has been permanently discontinued.',
  });
});

app.all(/^\/api\/admin-application(\/.*)?$/, (_req, res) => {
  return res.status(404).json({
    error: 'Public College Admin applications have been discontinued.',
  });
});

// =========================================================================
// COLLEGE ADMIN LOGIN ENDPOINT (Fixed Admin Credentials + Supabase Session)
// =========================================================================
const envAdminEmail = (process.env.ADMIN_LOGIN_EMAIL || '').trim();
const envAdminPassword = (process.env.ADMIN_LOGIN_PASSWORD || '').trim();
const FIXED_ADMIN_EMAIL =
  envAdminEmail && !envAdminEmail.startsWith('MY_')
    ? envAdminEmail
    : 'Admin27@gmail.com';
const FIXED_ADMIN_PASSWORD =
  envAdminPassword && !envAdminPassword.startsWith('MY_')
    ? envAdminPassword
    : 'Admin27';

app.post('/api/admin/login', async (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!rawEmail || !rawPassword) {
    return res.status(400).json({ error: 'Administrator email and password are required.' });
  }

  const matchesFixedEmail = rawEmail.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase();
  const matchesFixedPassword = rawPassword === FIXED_ADMIN_PASSWORD;

  if (!matchesFixedEmail || !matchesFixedPassword) {
    return res.status(401).json({ error: 'Invalid College Admin email or password.' });
  }

  // Preview / unconfigured Supabase mode: return a local verified admin session
  if (!isSupabaseReady || !publicSupabase) {
    return res.json({
      success: true,
      mode: 'local_admin',
      admin: {
        id: 'college-admin-27',
        email: FIXED_ADMIN_EMAIL,
        full_name: 'College Administrator',
        role: 'college_admin',
        college_id: 'configured-college',
        created_at: new Date().toISOString(),
      },
    });
  }

  try {
    // 1. Try signing into Supabase Auth directly with the fixed admin credentials
    let signInResult = await publicSupabase.auth.signInWithPassword({
      email: FIXED_ADMIN_EMAIL.toLowerCase(),
      password: FIXED_ADMIN_PASSWORD,
    });

    // 2. If user doesn't exist or password differs in Supabase Auth, auto-provision when service key is available
    if ((signInResult.error || !signInResult.data.session) && serviceSupabase) {
      let configuredCollege = await getConfiguredCollege(serviceSupabase);
      if (!configuredCollege) {
        const { data: createdCollege } = await serviceSupabase
          .from('colleges')
          .insert({ name: 'Galgotias University', code: 'GU' })
          .select('id, name, code')
          .single();
        if (createdCollege) {
          await serviceSupabase
            .from('app_config')
            .upsert({ id: 1, college_id: createdCollege.id }, { onConflict: 'id' });
          configuredCollege = await getConfiguredCollege(serviceSupabase);
        }
      }

      const targetCollegeId = configuredCollege?.id || null;

      // Check whether the user already exists in Supabase Auth
      const { data: usersList } = await serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingAuthUser = (usersList?.users || []).find(
        (u) => (u.email || '').toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase()
      );

      let adminUserId = existingAuthUser?.id || null;

      if (existingAuthUser) {
        await serviceSupabase.auth.admin.updateUserById(existingAuthUser.id, {
          password: FIXED_ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: {
            ...(existingAuthUser.user_metadata || {}),
            full_name: existingAuthUser.user_metadata?.full_name || 'College Administrator',
            role: 'college_admin',
            ...(targetCollegeId ? { college_id: targetCollegeId } : {}),
          },
        });
      } else {
        const { data: createdUser, error: createErr } = await serviceSupabase.auth.admin.createUser({
          email: FIXED_ADMIN_EMAIL.toLowerCase(),
          password: FIXED_ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: 'College Administrator',
            role: 'college_admin',
            ...(targetCollegeId ? { college_id: targetCollegeId } : {}),
          },
        });
        if (createErr || !createdUser.user) {
          return res.status(500).json({
            error: createErr?.message || 'Failed to provision College Admin account in Supabase Auth.',
          });
        }
        adminUserId = createdUser.user.id;
      }

      if (adminUserId && targetCollegeId) {
        await serviceSupabase.from('profiles').upsert(
          {
            id: adminUserId,
            full_name: 'College Administrator',
            email: FIXED_ADMIN_EMAIL.toLowerCase(),
            college_id: targetCollegeId,
            role: 'college_admin',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }

      // Retry sign-in after provisioning/syncing
      signInResult = await publicSupabase.auth.signInWithPassword({
        email: FIXED_ADMIN_EMAIL.toLowerCase(),
        password: FIXED_ADMIN_PASSWORD,
      });
    }

    if (signInResult.error || !signInResult.data.session || !signInResult.data.user) {
      return res.status(401).json({
        error:
          'College Admin account is not yet provisioned in Supabase Auth. Create Admin27@gmail.com in Supabase Auth (or configure SUPABASE_SERVICE_ROLE_KEY) and assign role = college_admin.',
      });
    }

    const authUser = signInResult.data.user;
    const authSession = signInResult.data.session;
    const userClient = createUserScopedClient(authSession.access_token);
    const db = getDbClient(userClient)!;

    let { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // Ensure profile has college_admin role when service key is available
    if (serviceSupabase && (!profile || (profile.role || '').toLowerCase() !== 'college_admin')) {
      const configuredCollege = await getConfiguredCollege(serviceSupabase);
      const targetCollegeId = profile?.college_id || configuredCollege?.id;
      if (targetCollegeId) {
        const { data: syncedProfile } = await serviceSupabase
          .from('profiles')
          .upsert(
            {
              id: authUser.id,
              full_name: profile?.full_name || 'College Administrator',
              email: FIXED_ADMIN_EMAIL.toLowerCase(),
              college_id: targetCollegeId,
              role: 'college_admin',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
          .select('*')
          .single();
        profile = syncedProfile || profile;
      }
    }

    if (!profile || (profile.role || '').toLowerCase() !== 'college_admin') {
      return res.status(403).json({
        error:
          'This account exists in Supabase Auth, but its public.profiles role is not set to college_admin yet. Run the Step 9 bootstrap UPDATE in supabase/single_college_migration.sql.',
      });
    }

    if (profile.is_suspended || String(profile.avatar_url || '').startsWith('[SUSPENDED]')) {
      return res.status(403).json({
        error: 'This administrator account is currently suspended.',
      });
    }

    return res.json({
      success: true,
      mode: 'supabase',
      session: {
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
      },
      profile,
    });
  } catch (err: any) {
    console.error('[POST /api/admin/login]', err);
    return res.status(500).json({ error: err?.message || 'Administrator sign in failed.' });
  }
});

// =========================================================================
// PUBLIC SINGLE-COLLEGE ENDPOINTS
// =========================================================================
app.get('/api/public/college', async (_req, res) => {
  if (!isSupabaseReady) {
    return res.json({
      configured: false,
      supabaseReady: false,
      college: null,
      reason: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  try {
    const college = await getConfiguredCollege();
    return res.json({
      configured: Boolean(college),
      supabaseReady: true,
      college,
      reason: college ? null : 'COLLEGE_NOT_INITIALIZED_OR_RLS_BLOCKED',
    });
  } catch (err: any) {
    console.error('[GET /api/public/college]', err);
    return res.status(500).json({ error: 'Failed to load college configuration.' });
  }
});

// Sanitized public read-only catalog (omits unique_marks, user_id, contact_preference, rejection_reason)
app.get('/api/public/items', async (req, res) => {
  if (!isSupabaseReady) {
    return res.json({ items: [], configured: false });
  }

  try {
    const db = serviceSupabase || publicSupabase!;
    const college = await getConfiguredCollege(db);

    let query = db
      .from('items')
      .select('*')
      .in('status', ['published', 'approved', 'PUBLISHED', 'APPROVED']);

    if (college?.id) {
      query = query.eq('college_id', college.id);
    }

    const typeParam = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : '';
    if (typeParam === 'lost' || typeParam === 'found') {
      query = query.in('type', [typeParam, typeParam.toUpperCase()]);
    }

    const categoryParam = typeof req.query.category === 'string' ? req.query.category : '';
    if (categoryParam && categoryParam !== 'ALL') {
      query = query.eq('category', categoryParam);
    }

    const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
    if (dateParam) {
      query = query.eq('date', dateParam);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

    if (error) {
      return res.status(500).json({ error: 'Failed to load public catalog.', details: error.message });
    }

    // Explicitly project ONLY safe public fields (never expose unique_marks, user_id, contact_preference, rejection_reason)
    const sanitizedItems = (data || []).map((item: any) => ({
      id: item.id,
      college_id: item.college_id,
      type: item.type,
      item_name: item.item_name,
      category: item.category,
      description: item.description,
      brand: item.brand ?? null,
      color: item.color ?? null,
      date: item.date,
      approximate_time: item.approximate_time ?? null,
      location: item.location,
      image_path: item.image_path ?? null,
      status: item.status,
      created_at: item.created_at,
    }));

    return res.json({
      configured: true,
      items: sanitizedItems,
    });
  } catch (err: any) {
    console.error('[GET /api/public/items]', err);
    return res.status(500).json({ error: 'Failed to fetch public items.' });
  }
});

// =========================================================================
// AI LOST/FOUND MATCHING ENGINE (Server-Side Gemini API)
// =========================================================================
const MATCH_SCORE_THRESHOLD = 55;
const PUBLISHED_STATUSES = ['published', 'approved', 'PUBLISHED', 'APPROVED'];

function isTransientAiError(err: any): boolean {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.statusCode || 0);
  return (
    status === 503 ||
    status === 429 ||
    status === 504 ||
    /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|timed out|high demand/i.test(msg)
  );
}

async function callGeminiWithTimeout(
  model: string,
  parts: any[],
  timeoutMs: number
): Promise<string | undefined> {
  if (!ai) return undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`Gemini request timed out after ${timeoutMs}ms`);
      err.status = 504;
      reject(err);
    }, timeoutMs);
  });

  try {
    const response: any = await Promise.race([
      ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              similarity_score: {
                type: Type.INTEGER,
                description: 'Evidence-based similarity score from 0 to 100',
              },
              ai_summary: {
                type: Type.STRING,
                description: '1-2 sentence neutral explanation summarizing evidence for or against a match',
              },
              match_reasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-4 concise, privacy-safe reasons comparing item name, category, brand, colour, location, date/time, description, and visual evidence',
              },
            },
            required: ['similarity_score', 'ai_summary', 'match_reasons'],
          },
        },
      }),
      timeoutPromise,
    ]);
    return response?.text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function evaluateLostFoundPair(cLost: any, cFound: any): Promise<{
  similarity_score: number;
  ai_summary: string;
  match_reasons: string[];
  model_used: string;
} | null> {
  if (!ai) return null;

  const [lostImgBase64, foundImgBase64] = await Promise.all([
    cLost.image_path ? fetchImageAsBase64(cLost.image_path) : Promise.resolve(null),
    cFound.image_path ? fetchImageAsBase64(cFound.image_path) : Promise.resolve(null),
  ]);

  const promptText = `You are the Campus Lost & Found matching assistant for Foundly.
Compare the following LOST report and FOUND report from the same college campus and evaluate whether they likely describe the same physical item.

LOST REPORT:
- Item Name: ${cLost.item_name || 'Not provided'}
- Category: ${cLost.category || 'OTHER'}
- Brand: ${cLost.brand || 'Not provided'}
- Colour: ${cLost.color || 'Not provided'}
- Description: ${cLost.description || 'Not provided'}
- Location Lost: ${cLost.location || 'Not provided'}
- Date Lost: ${cLost.date || 'Not provided'}
- Approximate Time Lost: ${cLost.approximate_time || 'Not provided'}
- Confidential Identifying Details (internal comparison only — DO NOT quote verbatim in output): ${cLost.unique_marks || 'Not provided'}

FOUND REPORT:
- Item Name: ${cFound.item_name || 'Not provided'}
- Category: ${cFound.category || 'OTHER'}
- Brand: ${cFound.brand || 'Not provided'}
- Colour: ${cFound.color || 'Not provided'}
- Description: ${cFound.description || 'Not provided'}
- Location Found: ${cFound.location || 'Not provided'}
- Date Found: ${cFound.date || 'Not provided'}
- Approximate Time Found: ${cFound.approximate_time || 'Not provided'}
- Confidential Identifying Details (internal comparison only — DO NOT quote verbatim in output): ${cFound.unique_marks || 'Not provided'}

EVALUATION RULES:
1. Compare item name, category, brand, colour, description, campus location proximity (e.g., room within the same block/building like "A block 105" and "A block" is a strong spatial match), date & approximate time plausibility, and attached photos if provided.
2. If the Found date is significantly earlier than the Lost date (more than 1 day before), reduce the score substantially unless typos are plausible.
3. Clearly penalize contradicting brands, colours, or fundamentally different item types.
4. Return a realistic similarity_score from 0 to 100 based strictly on the provided evidence.
5. PRIVACY & SAFETY: Never repeat confidential serial numbers, lock screen secrets, personal ID numbers, or student names in match_reasons or ai_summary. Refer only to public attributes or say "Private identifying details align" if applicable.
6. Never declare definitive ownership — this is only a potential match suggestion for human College Admin verification.`;

  const parts: any[] = [{ text: promptText }];
  if (lostImgBase64) {
    parts.push({ text: 'Attached photo of LOST item:' });
    parts.push({ inlineData: lostImgBase64 });
  }
  if (foundImgBase64) {
    parts.push({ text: 'Attached photo of FOUND item:' });
    parts.push({ inlineData: foundImgBase64 });
  }

  let rawText: string | undefined;
  let modelUsed = 'gemini-4-hydrogen';

  try {
    rawText = await callGeminiWithTimeout('gemini-4-hydrogen', parts, 18000);
  } catch (primaryErr: any) {
    if (isTransientAiError(primaryErr)) {
      console.warn(
        `[Gemini Match] Primary model gemini-4-hydrogen transient error (${primaryErr?.message || primaryErr}). Falling back to gemini-2.5-flash.`
      );
      modelUsed = 'gemini-2.5-flash';
      rawText = await callGeminiWithTimeout('gemini-2.5-flash', parts, 25000);
    } else {
      throw primaryErr;
    }
  }

  if (!rawText) return null;

  const parsed = JSON.parse(rawText);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.similarity_score ?? parsed.match_score) || 0)));
  const reasons = Array.isArray(parsed.match_reasons)
    ? parsed.match_reasons
        .map((r: any) => String(r || '').trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const summary =
    typeof parsed.ai_summary === 'string' && parsed.ai_summary.trim()
      ? parsed.ai_summary.trim()
      : 'AI identified similarities between these Lost and Found campus reports.';

  return {
    similarity_score: score,
    ai_summary: summary,
    match_reasons: reasons,
    model_used: modelUsed,
  };
}

let isBackgroundScanRunning = false;

async function runAutomaticMatching(options: {
  db: SupabaseClient;
  collegeId: string;
  itemId?: string;
  maxPairs?: number;
}) {
  const { db, collegeId, itemId, maxPairs = 10 } = options;

  if (!ai) {
    return {
      ok: false,
      reason: 'GEMINI_NOT_CONFIGURED',
      pairsEvaluated: 0,
      matchesCreated: 0,
      createdMatches: [] as any[],
      errors: ['GEMINI_API_KEY is not configured on the server.'],
    };
  }

  const pairsToEvaluate: Array<{ lost: any; found: any }> = [];

  // Load existing item_matches in this college to prevent duplicates
  const { data: existingMatches } = await db
    .from('item_matches')
    .select('lost_item_id, found_item_id')
    .eq('college_id', collegeId);

  const existingPairs = new Set<string>(
    (existingMatches || []).map((m: any) => `${m.lost_item_id}_${m.found_item_id}`)
  );

  if (itemId) {
    const { data: anchorItem, error: anchorErr } = await db
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (anchorErr || !anchorItem) {
      return {
        ok: false,
        reason: 'ITEM_NOT_FOUND',
        pairsEvaluated: 0,
        matchesCreated: 0,
        createdMatches: [] as any[],
        errors: [anchorErr?.message || 'Target item not found.'],
      };
    }

    if (anchorItem.college_id !== collegeId) {
      return {
        ok: false,
        reason: 'COLLEGE_MISMATCH',
        pairsEvaluated: 0,
        matchesCreated: 0,
        createdMatches: [] as any[],
        errors: ['Item does not belong to the configured college.'],
      };
    }

    const anchorStatus = (anchorItem.status || '').toLowerCase();
    if (!['published', 'approved'].includes(anchorStatus)) {
      return {
        ok: true,
        reason: 'ITEM_NOT_PUBLISHED',
        pairsEvaluated: 0,
        matchesCreated: 0,
        createdMatches: [] as any[],
        errors: [],
      };
    }

    const isLost = (anchorItem.type || '').toLowerCase() === 'lost';
    const oppositeTypes = isLost ? ['found', 'FOUND'] : ['lost', 'LOST'];

    const { data: candidates, error: candErr } = await db
      .from('items')
      .select('*')
      .eq('college_id', collegeId)
      .in('type', oppositeTypes)
      .in('status', PUBLISHED_STATUSES)
      .order('created_at', { ascending: false })
      .limit(30);

    if (candErr) {
      return {
        ok: false,
        reason: 'CANDIDATE_QUERY_FAILED',
        pairsEvaluated: 0,
        matchesCreated: 0,
        createdMatches: [] as any[],
        errors: [candErr.message],
      };
    }

    // Prioritize same category or OTHER category
    const sortedCandidates = (candidates || []).sort((a: any, b: any) => {
      const aSame = a.category === anchorItem.category ? 0 : 1;
      const bSame = b.category === anchorItem.category ? 0 : 1;
      return aSame - bSame;
    });

    for (const candidate of sortedCandidates) {
      const lost = isLost ? anchorItem : candidate;
      const found = isLost ? candidate : anchorItem;
      const pairKey = `${lost.id}_${found.id}`;
      if (existingPairs.has(pairKey)) continue;
      // Only compare compatible categories (same category, or either is OTHER)
      if (
        lost.category &&
        found.category &&
        lost.category !== found.category &&
        lost.category !== 'OTHER' &&
        found.category !== 'OTHER'
      ) {
        continue;
      }
      pairsToEvaluate.push({ lost, found });
      if (pairsToEvaluate.length >= maxPairs) break;
    }
  } else {
    // Full scan across all published Lost and Found items in the same college
    const [{ data: lostItems, error: lostErr }, { data: foundItems, error: foundErr }] = await Promise.all([
      db
        .from('items')
        .select('*')
        .eq('college_id', collegeId)
        .in('type', ['lost', 'LOST'])
        .in('status', PUBLISHED_STATUSES)
        .order('created_at', { ascending: false })
        .limit(30),
      db
        .from('items')
        .select('*')
        .eq('college_id', collegeId)
        .in('type', ['found', 'FOUND'])
        .in('status', PUBLISHED_STATUSES)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (lostErr || foundErr) {
      return {
        ok: false,
        reason: 'SCAN_QUERY_FAILED',
        pairsEvaluated: 0,
        matchesCreated: 0,
        createdMatches: [] as any[],
        errors: [lostErr?.message || foundErr?.message || 'Failed to query published items.'],
      };
    }

    for (const lost of lostItems || []) {
      for (const found of foundItems || []) {
        const pairKey = `${lost.id}_${found.id}`;
        if (existingPairs.has(pairKey)) continue;
        if (
          lost.category &&
          found.category &&
          lost.category !== found.category &&
          lost.category !== 'OTHER' &&
          found.category !== 'OTHER'
        ) {
          continue;
        }
        pairsToEvaluate.push({ lost, found });
        if (pairsToEvaluate.length >= maxPairs) break;
      }
      if (pairsToEvaluate.length >= maxPairs) break;
    }
  }

  let pairsEvaluated = 0;
  let matchesCreated = 0;
  const createdMatches: any[] = [];
  const errors: string[] = [];

  for (const { lost, found } of pairsToEvaluate) {
    try {
      const evaluation = await evaluateLostFoundPair(lost, found);
      pairsEvaluated++;
      if (!evaluation) continue;

      if (evaluation.similarity_score >= MATCH_SCORE_THRESHOLD) {
        const { data: insertedRows, error: insertErr } = await insertWithColumnPruning(db, 'item_matches', {
          college_id: collegeId,
          lost_item_id: lost.id,
          found_item_id: found.id,
          match_score: evaluation.similarity_score,
          ai_summary: evaluation.ai_summary,
          match_reasons: evaluation.match_reasons,
          status: 'SUGGESTED',
        });

        if (insertErr) {
          // Ignore unique duplicate race conditions silently
          if (insertErr.code !== '23505') {
            console.error('[Match Save Error]', insertErr);
            errors.push(`DB insert failed for pair (${lost.item_name} / ${found.item_name}): ${insertErr.message}`);
          }
          continue;
        }

        const insertedMatch = insertedRows?.[0];
        if (!insertedMatch) continue;

        matchesCreated++;
        createdMatches.push({
          ...insertedMatch,
          similarity_score: insertedMatch.match_score,
          model_used: evaluation.model_used,
          lost_item: sanitizePublicItem(lost),
          found_item: sanitizePublicItem(found),
        });

        // Privacy-safe notification to the student who lost the item (NO finder personal info!)
        try {
          if (lost.user_id) {
            await db.from('notifications').insert({
              user_id: lost.user_id,
              college_id: collegeId,
              title: 'Potential Match Found for Your Lost Item!',
              message: `A newly published Found Report ("${found.item_name}" near ${found.location || 'campus'}) matches your lost "${lost.item_name}" (${evaluation.similarity_score}% similarity). Open your dashboard to review and click "This Is My Item" for College Admin verification.`,
              type: `AI_MATCH_SUGGESTED:${found.id}`,
              read: false,
            });
          }

          // Notify College Admins so they can review in Potential Matches
          const { data: admins } = await db
            .from('profiles')
            .select('id')
            .eq('college_id', collegeId)
            .in('role', ['college_admin', 'COLLEGE_ADMIN']);

          if (admins && admins.length > 0) {
            await db.from('notifications').insert(
              admins.map((admin: any) => ({
                user_id: admin.id,
                college_id: collegeId,
                title: 'New Potential Lost & Found Match',
                message: `AI flagged a ${evaluation.similarity_score}% match between Lost "${lost.item_name}" and Found "${found.item_name}". Review in Potential Matches.`,
                type: `AI_MATCH_ADMIN:${insertedMatch.id}`,
                read: false,
              }))
            );
          }
        } catch (notifErr) {
          console.warn('[AI Match] Notification insert skipped:', notifErr);
        }

        try {
          await db.from('activity_logs').insert({
            college_id: collegeId,
            actor_id: null,
            action: 'AI_MATCH_CREATED',
            entity_type: 'ITEM_MATCH',
            entity_id: insertedMatch.id,
            metadata: {
              lost_item_id: lost.id,
              found_item_id: found.id,
              item_name: lost.item_name,
              similarity_score: evaluation.similarity_score,
              model_used: evaluation.model_used,
            },
          });
        } catch (logErr) {
          console.warn('[AI Match] Activity log skipped:', logErr);
        }
      }
    } catch (pairErr: any) {
      console.error('[Gemini Pair Evaluation Error]', pairErr?.message || pairErr);
      errors.push(pairErr?.message || 'Gemini evaluation error');
    }
  }

  return {
    ok: true,
    pairsEvaluated,
    matchesCreated,
    createdMatches,
    errors,
  };
}

// Trigger automatic matching when a report is approved & published
app.post('/api/match/trigger', async (req, res) => {
  try {
    const { db, collegeId } = await authenticateAdmin(req);
    const { itemId } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'AI Matching is temporarily unavailable.',
        details: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const result = await runAutomaticMatching({ db, collegeId, itemId, maxPairs: 10 });
    return res.json({
      success: result.ok,
      candidatesEvaluated: result.pairsEvaluated,
      matchesCreated: result.matchesCreated,
      matches: result.createdMatches,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('[POST /api/match/trigger]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Internal server error during AI matching.' });
  }
});

// Admin manual/full scan of all existing published Lost & Found items
app.post('/api/match/scan', async (req, res) => {
  if (!ai) {
    return res.status(503).json({
      error: 'AI Matching is temporarily unavailable.',
      details: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  try {
    const { db, collegeId } = await authenticateAdmin(req);
    const result = await runAutomaticMatching({ db, collegeId, maxPairs: 15 });
    return res.json({
      success: result.ok,
      pairsEvaluated: result.pairsEvaluated,
      matchesCreated: result.matchesCreated,
      matches: result.createdMatches,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('[POST /api/match/scan]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to scan published reports for matches.' });
  }
});

// Admin: Fetch all Potential Matches for configured college (with full Lost & Found details + linked claim state)
app.get('/api/admin/matches', async (req, res) => {
  try {
    const { db, collegeId } = await authenticateAdmin(req);
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL';

    const { data: rows, error } = await db
      .from('item_matches')
      .select(`
        *,
        lost_item:items!lost_item_id(*),
        found_item:items!found_item_id(*)
      `)
      .eq('college_id', collegeId)
      .order('match_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to load potential matches.', details: error.message });
    }

    // Load active claims for matched found items so admin can see linked claims immediately
    const foundIds = Array.from(new Set((rows || []).map((r: any) => r.found_item_id).filter(Boolean)));
    const claimByPair = new Map<string, any>();

    if (foundIds.length > 0) {
      const { data: claimRows } = await db
        .from('claims')
        .select('id, item_id, claimant_id, status, additional_message, created_at')
        .eq('college_id', collegeId)
        .in('item_id', foundIds)
        .neq('status', 'rejected');

      for (const c of claimRows || []) {
        claimByPair.set(`${c.item_id}_${c.claimant_id}`, c);
      }
    }

    let formatted = (rows || []).map((m: any) => {
      const lostItem = m.lost_item
        ? { ...m.lost_item, type: (m.lost_item.type || 'LOST').toUpperCase(), status: (m.lost_item.status || 'PUBLISHED').toUpperCase() }
        : null;
      const foundItem = m.found_item
        ? { ...m.found_item, type: (m.found_item.type || 'FOUND').toUpperCase(), status: (m.found_item.status || 'PUBLISHED').toUpperCase() }
        : null;
      const linkedClaim = lostItem && foundItem ? claimByPair.get(`${foundItem.id}_${lostItem.user_id}`) : null;

      return {
        ...m,
        similarity_score: Number(m.match_score) || 0,
        match_score: Number(m.match_score) || 0,
        match_reasons: Array.isArray(m.match_reasons) ? m.match_reasons : [],
        status: (m.status || 'SUGGESTED').toUpperCase(),
        lost_item: lostItem,
        found_item: foundItem,
        existing_claim_id: linkedClaim?.id || null,
        existing_claim_status: linkedClaim ? (linkedClaim.status || 'PENDING').toUpperCase() : null,
      };
    });

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'DISMISSED') {
        formatted = formatted.filter((m: any) => m.status === 'DISMISSED' || m.status === 'NOT_A_MATCH');
      } else {
        formatted = formatted.filter((m: any) => m.status === statusFilter);
      }
    }

    return res.json({ matches: formatted, aiReady: Boolean(ai) });
  } catch (err: any) {
    console.error('[GET /api/admin/matches]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to fetch potential matches.' });
  }
});

// Admin: Review or Dismiss a potential match (STRICTLY NEVER auto-approves claims or marks items returned)
app.patch('/api/admin/matches/:id', async (req, res) => {
  const matchId = req.params.id;
  const rawStatus = typeof req.body?.status === 'string' ? req.body.status.toUpperCase() : '';
  const allowedStatuses = ['VERIFIED', 'DISMISSED', 'NOT_A_MATCH', 'SUGGESTED'];

  if (!allowedStatuses.includes(rawStatus)) {
    return res.status(400).json({
      error: 'Invalid match status. Allowed values: VERIFIED, DISMISSED, NOT_A_MATCH, SUGGESTED.',
    });
  }

  try {
    const { user, profile, db, collegeId } = await authenticateAdmin(req);

    const { data: existing, error: fetchErr } = await db
      .from('item_matches')
      .select('id, college_id, lost_item_id, found_item_id, status')
      .eq('id', matchId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Potential match record not found.' });
    }

    if (existing.college_id !== collegeId) {
      return res.status(403).json({ error: 'Forbidden. Match belongs to another college.' });
    }

    const { data: updatedRows, error: updateErr } = await updateWithColumnPruning(
      db,
      'item_matches',
      'id',
      matchId,
      {
        status: rawStatus,
        updated_at: new Date().toISOString(),
      }
    );

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update match status.', details: updateErr.message });
    }

    try {
      await db.from('activity_logs').insert({
        college_id: collegeId,
        actor_id: user.id,
        action: rawStatus === 'VERIFIED' ? 'AI_MATCH_REVIEWED' : 'AI_MATCH_DISMISSED',
        entity_type: 'ITEM_MATCH',
        entity_id: matchId,
        metadata: {
          new_status: rawStatus,
          lost_item_id: existing.lost_item_id,
          found_item_id: existing.found_item_id,
          admin_email: profile.email,
        },
      });
    } catch (logErr) {
      console.warn('[PATCH /api/admin/matches/:id] Activity log skipped:', logErr);
    }

    return res.json({
      success: true,
      match: updatedRows?.[0] || { ...existing, status: rawStatus },
      note: 'Match status updated. Ownership verification and handover remain strictly under College Admin control.',
    });
  } catch (err: any) {
    console.error('[PATCH /api/admin/matches/:id]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to update match status.' });
  }
});

// Student: Privacy-safe Potential Matches involving the student's Lost/Found reports
app.get('/api/student/matches', async (req, res) => {
  try {
    const { user, db, collegeId } = await authenticateUser(req);

    // Find all item IDs belonging to the authenticated student
    const { data: myItems, error: myItemsErr } = await db
      .from('items')
      .select('id, type')
      .eq('college_id', collegeId)
      .eq('user_id', user.id);

    if (myItemsErr) {
      return res.status(500).json({ error: 'Failed to load your reports.', details: myItemsErr.message });
    }

    const myItemIds = (myItems || []).map((i: any) => i.id);
    if (myItemIds.length === 0) {
      return res.json({ matches: [] });
    }

    const idList = myItemIds.join(',');
    const { data: rows, error: matchErr } = await db
      .from('item_matches')
      .select(`
        *,
        lost_item:items!lost_item_id(*),
        found_item:items!found_item_id(*)
      `)
      .eq('college_id', collegeId)
      .or(`lost_item_id.in.(${idList}),found_item_id.in.(${idList})`)
      .not('status', 'in', '("DISMISSED","NOT_A_MATCH","dismissed","not_a_match")')
      .order('match_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (matchErr) {
      return res.status(500).json({ error: 'Failed to load potential matches.', details: matchErr.message });
    }

    // Fetch the student's existing non-rejected claims so UI knows whether they already clicked "This Is My Item"
    const { data: myClaims } = await db
      .from('claims')
      .select('id, item_id, status, additional_message')
      .eq('college_id', collegeId)
      .eq('claimant_id', user.id)
      .neq('status', 'rejected');

    const claimByFoundItem = new Map<string, any>();
    for (const c of myClaims || []) {
      claimByFoundItem.set(c.item_id, c);
    }

    const sanitizedMatches = (rows || [])
      .filter((m: any) => m.lost_item && m.found_item)
      .map((m: any) => {
        const ownsLost = m.lost_item.user_id === user.id;
        const ownsFound = m.found_item.user_id === user.id;
        const userRoleInMatch: 'LOST_OWNER' | 'FINDER' | 'BOTH' =
          ownsLost && ownsFound ? 'BOTH' : ownsLost ? 'LOST_OWNER' : 'FINDER';

        const existingClaim = claimByFoundItem.get(m.found_item.id) || null;
        const foundStatusLower = (m.found_item.status || '').toLowerCase();
        const lostStatusLower = (m.lost_item.status || '').toLowerCase();
        const canClaimFromLostReport =
          ownsLost &&
          !ownsFound &&
          !existingClaim &&
          ['published', 'approved'].includes(foundStatusLower) &&
          !['returned', 'closed', 'rejected'].includes(lostStatusLower);

        return {
          id: m.id,
          lost_item_id: m.lost_item_id,
          found_item_id: m.found_item_id,
          college_id: m.college_id,
          match_score: Number(m.match_score) || 0,
          similarity_score: Number(m.match_score) || 0,
          match_reasons: Array.isArray(m.match_reasons) ? m.match_reasons : [],
          ai_summary: m.ai_summary || '',
          status: (m.status || 'SUGGESTED').toUpperCase(),
          created_at: m.created_at,
          user_role_in_match: userRoleInMatch,
          // Strictly sanitize the OTHER student's item to prevent exposing private marks or identity
          lost_item: ownsLost
            ? { ...m.lost_item, type: 'LOST', status: (m.lost_item.status || 'PUBLISHED').toUpperCase() }
            : sanitizePublicItem(m.lost_item),
          found_item: ownsFound
            ? { ...m.found_item, type: 'FOUND', status: (m.found_item.status || 'PUBLISHED').toUpperCase() }
            : sanitizePublicItem(m.found_item),
          existing_claim_id: existingClaim?.id || null,
          existing_claim_status: existingClaim ? (existingClaim.status || 'PENDING').toUpperCase() : null,
          can_claim_from_lost_report: canClaimFromLostReport,
        };
      });

    return res.json({ matches: sanitizedMatches });
  } catch (err: any) {
    console.error('[GET /api/student/matches]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to load your potential matches.' });
  }
});

// Student: Dismiss a potential match ("Not a Match")
app.patch('/api/student/matches/:id/dismiss', async (req, res) => {
  const matchId = req.params.id;
  try {
    const { user, db, collegeId } = await authenticateUser(req);

    const { data: match, error: fetchErr } = await db
      .from('item_matches')
      .select('id, college_id, lost_item:items!lost_item_id(user_id), found_item:items!found_item_id(user_id)')
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) {
      return res.status(404).json({ error: 'Match record not found.' });
    }

    const lostOwner = (match as any).lost_item?.user_id;
    const foundOwner = (match as any).found_item?.user_id;
    if (match.college_id !== collegeId || (lostOwner !== user.id && foundOwner !== user.id)) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to dismiss this match.' });
    }

    const { error: updateErr } = await updateWithColumnPruning(db, 'item_matches', 'id', matchId, {
      status: 'NOT_A_MATCH',
      updated_at: new Date().toISOString(),
    });

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to dismiss match.', details: updateErr.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/student/matches/:id/dismiss]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to dismiss match.' });
  }
});

// =========================================================================
// ONE-CLICK "THIS IS MY ITEM" LINKED CLAIM (From Existing Lost Report)
// =========================================================================
app.post('/api/student/claims/from-lost-report', async (req, res) => {
  try {
    const { user, profile, db, collegeId } = await authenticateUser(req);
    const { foundItemId, lostItemId, matchId, additionalNote } = req.body || {};

    if (!foundItemId || !lostItemId) {
      return res.status(400).json({ error: 'foundItemId and lostItemId are required.' });
    }

    // 1. Validate Lost Report belongs to the student and is still open
    const { data: lostItem, error: lostErr } = await db
      .from('items')
      .select('*')
      .eq('id', lostItemId)
      .single();

    if (lostErr || !lostItem) {
      return res.status(404).json({ error: 'Your Lost Report could not be found.' });
    }

    if (lostItem.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden. You can only link your own Lost Report.' });
    }

    if ((lostItem.type || '').toLowerCase() !== 'lost') {
      return res.status(400).json({ error: 'Selected report is not a Lost Report.' });
    }

    if (lostItem.college_id !== collegeId) {
      return res.status(403).json({ error: 'Forbidden. Lost Report belongs to another campus.' });
    }

    const lostStatus = (lostItem.status || '').toLowerCase();
    if (['returned', 'closed', 'rejected'].includes(lostStatus)) {
      return res.status(400).json({ error: 'This Lost Report is already closed and cannot be linked to a new claim.' });
    }

    // 2. Validate Found Report is open & claimable (and NOT reported by the same user)
    const { data: foundItem, error: foundErr } = await db
      .from('items')
      .select('*')
      .eq('id', foundItemId)
      .single();

    if (foundErr || !foundItem) {
      return res.status(404).json({ error: 'Found item listing not found.' });
    }

    if ((foundItem.type || '').toLowerCase() !== 'found') {
      return res.status(400).json({ error: 'Only Found item listings can be claimed.' });
    }

    if (foundItem.college_id !== collegeId) {
      return res.status(403).json({ error: 'Forbidden. Found item belongs to another campus.' });
    }

    if (foundItem.user_id === user.id) {
      return res.status(400).json({ error: 'You cannot submit an ownership claim for a Found item that you reported.' });
    }

    const foundStatus = (foundItem.status || '').toLowerCase();
    if (!['published', 'approved'].includes(foundStatus)) {
      return res.status(400).json({ error: 'This Found item is no longer open for ownership claims.' });
    }

    // 3. Prevent duplicate active claims for the same found item by this student
    const { data: existingClaims } = await db
      .from('claims')
      .select('id, status')
      .eq('item_id', foundItem.id)
      .eq('claimant_id', user.id)
      .neq('status', 'rejected');

    if (existingClaims && existingClaims.length > 0) {
      return res.status(409).json({
        error: 'You already have an active ownership claim for this item awaiting College Admin review.',
        existingClaimId: existingClaims[0].id,
      });
    }

    // 4. Resolve optional match_id (if matched in item_matches)
    let resolvedMatchId: string | null = typeof matchId === 'string' && matchId.trim() ? matchId.trim() : null;
    if (!resolvedMatchId) {
      const { data: matchedRow } = await db
        .from('item_matches')
        .select('id')
        .eq('lost_item_id', lostItem.id)
        .eq('found_item_id', foundItem.id)
        .maybeSingle();
      if (matchedRow?.id) {
        resolvedMatchId = matchedRow.id;
      }
    }

    // 5. Auto-compose linked claim payload from the student's existing Lost Report (NO duplicate form needed!)
    const explanationParts = [
      `Linked from Lost Report "${lostItem.item_name}"`,
      lostItem.brand ? `Brand: ${lostItem.brand}` : null,
      lostItem.color ? `Colour: ${lostItem.color}` : null,
      lostItem.description ? `Description: ${lostItem.description}` : null,
    ].filter(Boolean);

    const refTags = [
      `[Linked Lost Report: ${lostItem.id}]`,
      resolvedMatchId ? `[Match Ref: ${resolvedMatchId}]` : null,
    ].filter(Boolean);

    const trimmedNote = typeof additionalNote === 'string' ? additionalNote.trim() : '';
    const composedAdditionalMessage = trimmedNote
      ? `${trimmedNote}\n${refTags.join(' ')}`
      : refTags.join(' ');

    const contactInfo =
      [profile.phone, profile.email, lostItem.contact_preference ? `Preferred: ${lostItem.contact_preference}` : null]
        .filter(Boolean)
        .join(' • ') || null;

    // IMPORTANT: Status is ALWAYS 'pending' — AI NEVER approves claims or confirms ownership.
    const { data: createdClaims, error: insertErr } = await insertWithColumnPruning(db, 'claims', {
      item_id: foundItem.id,
      claimant_id: user.id,
      college_id: collegeId,
      lost_item_id: lostItem.id,
      match_id: resolvedMatchId,
      claim_explanation: explanationParts.join(' | '),
      lost_date: lostItem.date || null,
      lost_location: lostItem.location || null,
      identifying_details: lostItem.unique_marks || null,
      contact_information: contactInfo,
      additional_message: composedAdditionalMessage,
      status: 'pending',
    });

    if (insertErr || !createdClaims?.[0]) {
      console.error('[POST /api/student/claims/from-lost-report] Insert error:', insertErr);
      return res.status(500).json({
        error: 'Failed to create linked ownership claim.',
        details: insertErr?.message,
      });
    }

    const createdClaim = createdClaims[0];

    // 6. Update matching item_matches record to CLAIMED (not approved/returned — awaiting admin verification!)
    if (resolvedMatchId) {
      await updateWithColumnPruning(db, 'item_matches', 'id', resolvedMatchId, {
        status: 'CLAIMED',
        updated_at: new Date().toISOString(),
      });
    }

    // 7. Notify College Admins + Student
    try {
      const { data: admins } = await db
        .from('profiles')
        .select('id')
        .eq('college_id', collegeId)
        .in('role', ['college_admin', 'COLLEGE_ADMIN']);

      if (admins && admins.length > 0) {
        await db.from('notifications').insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            college_id: collegeId,
            title: 'New Linked Ownership Claim Submitted',
            message: `${profile.full_name || 'A student'} claimed found "${foundItem.item_name}" using their Lost Report "${lostItem.item_name}". College Admin verification is required.`,
            type: `CLAIM_SUBMITTED:${foundItem.id}`,
            read: false,
          }))
        );
      }

      await db.from('notifications').insert({
        user_id: user.id,
        college_id: collegeId,
        title: 'Claim Submitted for Admin Verification',
        message: `Your claim for "${foundItem.item_name}" has been linked to your Lost Report and sent to the College Admin for ownership verification.`,
        type: `CLAIM_SUBMITTED:${foundItem.id}`,
        read: false,
      });
    } catch (notifErr) {
      console.warn('[Linked Claim] Notification insert skipped:', notifErr);
    }

    // 8. Audit log
    try {
      await db.from('activity_logs').insert({
        college_id: collegeId,
        actor_id: user.id,
        action: 'LINKED_CLAIM_CREATED',
        entity_type: 'CLAIM',
        entity_id: createdClaim.id,
        metadata: {
          item_name: foundItem.item_name,
          found_item_id: foundItem.id,
          lost_item_id: lostItem.id,
          match_id: resolvedMatchId,
        },
      });
    } catch (logErr) {
      console.warn('[Linked Claim] Activity log insert skipped:', logErr);
    }

    return res.status(201).json({
      success: true,
      claim: createdClaim,
      message: 'Claim linked to your Lost Report and sent to the College Admin for verification.',
    });
  } catch (err: any) {
    console.error('[POST /api/student/claims/from-lost-report]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to submit linked claim.' });
  }
});

// =========================================================================
// CLAIM HANDOVER & RETURN COMPLETION + RESEND EMAILS
// =========================================================================
app.post('/api/claim/handover', async (req, res) => {
  const { claimId } = req.body;

  if (!claimId) {
    return res.status(400).json({ error: 'claimId is required.' });
  }

  try {
    const { user, profile, db, collegeId } = await authenticateAdmin(req);

    const { data: claim, error: claimErr } = await db
      .from('claims')
      .select('*, items(*)')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }

    if (collegeId && claim.college_id !== collegeId) {
      return res.status(403).json({ error: 'Forbidden. This claim does not belong to the configured college.' });
    }

    const currentStatus = (claim.status || '').toLowerCase();
    if (currentStatus !== 'approved') {
      return res.status(400).json({
        error: `Claim must be approved before moving to handover. Current status: ${claim.status}`,
      });
    }

    const timestamp = new Date().toISOString();

    const { error: claimUpdateErr } = await updateWithColumnPruning(db, 'claims', 'id', claimId, {
      status: 'handover',
      handover_at: timestamp,
    });

    if (claimUpdateErr) {
      return res.status(500).json({ error: 'Failed to update claim status.', details: claimUpdateErr.message });
    }

    await updateWithColumnPruning(db, 'items', 'id', claim.item_id, { status: 'handover' });

    try {
      await db.from('notifications').insert({
        user_id: claim.claimant_id,
        college_id: claim.college_id,
        title: 'Ready for handover',
        message: `Your approved claim for "${claim.items?.item_name}" is now ready for physical handover! Please visit the campus Lost & Found office.`,
        type: `HANDOVER_PENDING:${claim.item_id}`,
        read: false,
      });
    } catch (notifErr) {
      console.warn('[Handover] Notification insert skipped:', notifErr);
    }

    try {
      await db.from('activity_logs').insert({
        college_id: claim.college_id,
        actor_id: user.id,
        action: 'CLAIM_MOVED_TO_HANDOVER',
        entity_type: 'CLAIM',
        entity_id: claimId,
        metadata: {
          item_name: claim.items?.item_name,
          admin_email: profile.email,
        },
      });
    } catch (logErr) {
      console.warn('[Handover] Activity log insert skipped:', logErr);
    }

    return res.json({ success: true, message: 'Claim successfully moved to handover.' });
  } catch (err: any) {
    console.error('[Move to Handover Error]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to move claim to handover.' });
  }
});

async function sendReturnEmails(claimId: string, backendClient: SupabaseClient) {
  const results = {
    finderEmailSent: false,
    ownerEmailSent: false,
    errors: [] as string[],
  };

  try {
    const { data: claim, error: claimErr } = await backendClient
      .from('claims')
      .select('*, items(*)')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      throw new Error(`Claim ${claimId} not found.`);
    }

    if (claim.status?.toLowerCase() !== 'completed') {
      throw new Error(`Claim ${claimId} is not completed (current status: ${claim.status}).`);
    }

    if (claim.items?.status?.toLowerCase() !== 'returned') {
      throw new Error(`Item associated with claim is not returned (current status: ${claim.items?.status}).`);
    }

    const { data: ownerProfile } = await backendClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', claim.claimant_id)
      .single();

    const { data: finderProfile } = await backendClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', claim.items?.user_id)
      .single();

    const { data: sentLogs } = await backendClient
      .from('activity_logs')
      .select('action')
      .eq('entity_id', claimId)
      .in('action', ['FINDER_EMAIL_SENT', 'OWNER_EMAIL_SENT']);

    const alreadySentActions = new Set((sentLogs || []).map((l: any) => l.action));

    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const fromEmail = (process.env.FROM_EMAIL || 'Foundly <onboarding@resend.dev>').trim();

    if (!resendApiKey) {
      const msg = 'RESEND_API_KEY environment variable is not configured. Email skipped.';
      console.warn(`[Resend Auto] ${msg}`);
      results.errors.push(msg);
      return results;
    }

    if (finderProfile?.email) {
      if (alreadySentActions.has('FINDER_EMAIL_SENT')) {
        results.finderEmailSent = true;
      } else {
        const finderName = finderProfile.full_name || 'there';
        const finderHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="margin-bottom: 20px;">
              <strong style="color: #4f46e5; font-size: 18px; letter-spacing: -0.025em;">FOUNDLY</strong>
              <span style="color: #94a3b8; font-size: 12px; margin-left: 8px;">Campus Lost &amp; Found</span>
            </div>
            <p>Hi ${finderName},</p>
            <p>Thank you for reporting the found item <strong>${claim.items?.item_name || 'on campus'}</strong> on Foundly.</p>
            <p>The item has been verified and safely returned to its rightful owner.</p>
            <p>Thank you for helping make your campus community safer and more helpful.</p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
            <p style="font-size: 13px; color: #64748b;">Best regards,<br /><strong>Campus Lost &amp; Found Team</strong></p>
          </div>
        `;

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [finderProfile.email],
            subject: 'Thank you for helping return a found item on Foundly',
            html: finderHtml,
          }),
        });

        const respData: any = await resp.json().catch(() => ({}));
        if (resp.ok) {
          results.finderEmailSent = true;
          await backendClient.from('activity_logs').insert({
            college_id: claim.college_id,
            actor_id: null,
            action: 'FINDER_EMAIL_SENT',
            entity_type: 'CLAIM',
            entity_id: claimId,
            metadata: {
              recipient: finderProfile.email,
              item_name: claim.items?.item_name,
              resend_id: respData.id || null,
            },
          });
        } else {
          const errMsg = respData.message || respData.error || `HTTP ${resp.status}`;
          results.errors.push(`Finder email error: ${errMsg}`);
          await backendClient.from('activity_logs').insert({
            college_id: claim.college_id,
            actor_id: null,
            action: 'EMAIL_SEND_FAILED',
            entity_type: 'CLAIM',
            entity_id: claimId,
            metadata: { target: 'FINDER', recipient: finderProfile.email, error: errMsg },
          });
        }
      }
    }

    if (ownerProfile?.email) {
      if (alreadySentActions.has('OWNER_EMAIL_SENT')) {
        results.ownerEmailSent = true;
      } else {
        const ownerName = ownerProfile.full_name || 'there';
        const ownerHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="margin-bottom: 20px;">
              <strong style="color: #4f46e5; font-size: 18px; letter-spacing: -0.025em;">FOUNDLY</strong>
              <span style="color: #94a3b8; font-size: 12px; margin-left: 8px;">Campus Lost &amp; Found</span>
            </div>
            <p>Hi ${ownerName},</p>
            <p>Your claim for <strong>${claim.items?.item_name || 'your item'}</strong> has been completed and the item handover has been confirmed by your college administrator.</p>
            <p>We&apos;re glad your item found its way back to you.</p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
            <p style="font-size: 13px; color: #64748b;">Best regards,<br /><strong>Campus Lost &amp; Found Team</strong></p>
          </div>
        `;

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [ownerProfile.email],
            subject: 'Your lost item return has been confirmed on Foundly',
            html: ownerHtml,
          }),
        });

        const respData: any = await resp.json().catch(() => ({}));
        if (resp.ok) {
          results.ownerEmailSent = true;
          await backendClient.from('activity_logs').insert({
            college_id: claim.college_id,
            actor_id: null,
            action: 'OWNER_EMAIL_SENT',
            entity_type: 'CLAIM',
            entity_id: claimId,
            metadata: {
              recipient: ownerProfile.email,
              item_name: claim.items?.item_name,
              resend_id: respData.id || null,
            },
          });
        } else {
          const errMsg = respData.message || respData.error || `HTTP ${resp.status}`;
          results.errors.push(`Owner email error: ${errMsg}`);
          await backendClient.from('activity_logs').insert({
            college_id: claim.college_id,
            actor_id: null,
            action: 'EMAIL_SEND_FAILED',
            entity_type: 'CLAIM',
            entity_id: claimId,
            metadata: { target: 'OWNER', recipient: ownerProfile.email, error: errMsg },
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[Resend Auto Fatal Error]', err);
    results.errors.push(err.message || 'Unknown error in sendReturnEmails');
  }

  return results;
}

app.post('/api/claim/confirm-return', async (req, res) => {
  const { claimId, handoverNotes } = req.body;

  if (!claimId) {
    return res.status(400).json({ error: 'claimId is required.' });
  }

  try {
    const { user, profile, db, collegeId } = await authenticateAdmin(req);

    const { data: claim, error: claimErr } = await db
      .from('claims')
      .select('*, items(*)')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }

    if (collegeId && claim.college_id !== collegeId) {
      return res.status(403).json({ error: 'Forbidden. This claim belongs to another college.' });
    }

    const currentStatus = (claim.status || '').toLowerCase();
    if (currentStatus === 'completed') {
      return res.status(400).json({ error: 'This claim has already been completed and returned.' });
    }

    if (currentStatus !== 'handover') {
      return res.status(400).json({
        error: `Claim must be in handover state before confirming return. Current status: ${claim.status}`,
      });
    }

    const timestamp = new Date().toISOString();

    const { error: claimUpdateErr } = await updateWithColumnPruning(db, 'claims', 'id', claimId, {
      status: 'completed',
      completed_at: timestamp,
      handover_notes: handoverNotes ? String(handoverNotes).trim() : null,
    });

    if (claimUpdateErr) {
      return res.status(500).json({ error: 'Failed to update claim to completed.', details: claimUpdateErr.message });
    }

    await updateWithColumnPruning(db, 'items', 'id', claim.item_id, {
      status: 'returned',
      returned_at: timestamp,
    });

    // If this claim was linked to a Lost Report (via "This Is My Item" or match), mark that Lost Report RETURNED too
    let linkedLostItemId = extractLinkedLostItemId(claim);
    if (!linkedLostItemId) {
      const { data: matchedLinks } = await db
        .from('item_matches')
        .select('id, lost_item_id, lost_item:items!lost_item_id(id, user_id, status)')
        .eq('found_item_id', claim.item_id);

      const ownerMatch = (matchedLinks || []).find(
        (m: any) => m.lost_item && m.lost_item.user_id === claim.claimant_id
      );
      if (ownerMatch?.lost_item_id) {
        linkedLostItemId = ownerMatch.lost_item_id;
      }
    }

    if (linkedLostItemId) {
      await updateWithColumnPruning(db, 'items', 'id', linkedLostItemId, {
        status: 'returned',
        returned_at: timestamp,
      });
    }

    // Close/update item_matches associated with this returned found item
    try {
      const { data: relatedMatches } = await db
        .from('item_matches')
        .select('id, lost_item_id')
        .eq('found_item_id', claim.item_id);

      for (const m of relatedMatches || []) {
        const isWinningPair = linkedLostItemId && m.lost_item_id === linkedLostItemId;
        await updateWithColumnPruning(db, 'item_matches', 'id', m.id, {
          status: isWinningPair ? 'VERIFIED' : 'DISMISSED',
          updated_at: timestamp,
        });
      }
    } catch (matchCloseErr) {
      console.warn('[Confirm Return] Match status update skipped:', matchCloseErr);
    }

    // Reject competing open claims
    const { data: otherClaims } = await db
      .from('claims')
      .select('id, claimant_id')
      .eq('item_id', claim.item_id)
      .neq('id', claimId)
      .in('status', ['pending', 'under_review', 'approved', 'handover', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'HANDOVER']);

    if (otherClaims && otherClaims.length > 0) {
      for (const other of otherClaims) {
        await updateWithColumnPruning(db, 'claims', 'id', other.id, {
          status: 'rejected',
          rejection_reason: 'Item was verified and physically returned to another confirmed owner.',
          reviewed_by: user.id,
          reviewed_at: timestamp,
        });

        try {
          await db.from('notifications').insert({
            user_id: other.claimant_id,
            college_id: claim.college_id,
            title: 'Claim closed',
            message: `The item "${claim.items?.item_name}" has been verified and returned to another claimant.`,
            type: `CLAIM_REJECTED:${claim.item_id}`,
            read: false,
          });
        } catch (notifErr) {
          console.warn('[Confirm Return] Competing notification skipped:', notifErr);
        }
      }
    }

    try {
      await db.from('notifications').insert({
        user_id: claim.claimant_id,
        college_id: claim.college_id,
        title: 'Item returned',
        message: `Your claim for "${claim.items?.item_name}" is completed and the item handover has been confirmed!`,
        type: `CLAIM_COMPLETED:${claim.item_id}`,
        read: false,
      });

      if (claim.items?.user_id && claim.items.user_id !== claim.claimant_id) {
        await db.from('notifications').insert({
          user_id: claim.items.user_id,
          college_id: claim.college_id,
          title: 'Found item returned to owner',
          message: `Thank you! The "${claim.items?.item_name}" you reported has been verified and safely returned to its rightful owner.`,
          type: `ITEM_RETURNED:${claim.item_id}`,
          read: false,
        });
      }
    } catch (notifErr) {
      console.warn('[Confirm Return] Notification insert skipped:', notifErr);
    }

    try {
      await db.from('activity_logs').insert([
        {
          college_id: claim.college_id,
          actor_id: user.id,
          action: 'ITEM_RETURNED',
          entity_type: 'ITEM',
          entity_id: claim.item_id,
          metadata: { item_name: claim.items?.item_name, admin_email: profile.email },
        },
        {
          college_id: claim.college_id,
          actor_id: user.id,
          action: 'CLAIM_COMPLETED',
          entity_type: 'CLAIM',
          entity_id: claimId,
          metadata: {
            item_name: claim.items?.item_name,
            handover_notes: handoverNotes ? String(handoverNotes).trim() : undefined,
            admin_email: profile.email,
          },
        },
      ]);
    } catch (logErr) {
      console.warn('[Confirm Return] Activity log insert skipped:', logErr);
    }

    const emailStatus = await sendReturnEmails(claimId, db);

    return res.json({
      success: true,
      message: 'Return confirmed and handover closed successfully.',
      emailStatus,
    });
  } catch (err: any) {
    console.error('[Confirm Return Error]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to confirm return.' });
  }
});

app.post('/api/send-return-emails', async (req, res) => {
  const { claimId } = req.body;
  if (!claimId) {
    return res.status(400).json({ error: 'claimId is required.' });
  }

  try {
    const { db } = await authenticateAdmin(req);
    const emailResults = await sendReturnEmails(claimId, db);
    return res.json({
      success: true,
      message: 'Return email workflow processed.',
      results: emailResults,
    });
  } catch (err: any) {
    console.error('[Manual Send Return Emails Error]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to dispatch return emails.' });
  }
});

// =========================================================================
// COLLEGE ADMIN ROLE ASSIGNMENT (Authorized College Admins Only)
// =========================================================================
app.post('/api/admin/assign-admin', async (req, res) => {
  const { targetUserId, newRole } = req.body || {};

  if (!targetUserId || !['student', 'college_admin'].includes(String(newRole))) {
    return res.status(400).json({
      error: 'targetUserId and valid newRole ("student" or "college_admin") are required.',
    });
  }

  try {
    const { user, profile, db, collegeId } = await authenticateAdmin(req);

    if (targetUserId === user.id && newRole !== 'college_admin') {
      return res.status(400).json({
        error: 'You cannot demote your own administrator account.',
      });
    }

    const { data: targetProfile, error: targetErr } = await db
      .from('profiles')
      .select('id, full_name, email, role, college_id')
      .eq('id', targetUserId)
      .single();

    if (targetErr || !targetProfile) {
      return res.status(404).json({ error: 'Target user profile not found.' });
    }

    if (collegeId && targetProfile.college_id && targetProfile.college_id !== collegeId) {
      return res.status(403).json({ error: 'Target user does not belong to the configured college.' });
    }

    if (targetProfile.role === 'college_admin' && newRole === 'student') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('college_id', collegeId)
        .eq('role', 'college_admin');

      if ((count || 0) <= 1) {
        return res.status(400).json({
          error: 'Cannot remove the last remaining College Admin.',
        });
      }
    }

    // Prefer RPC assign_college_admin_role (uses p_target_user_id / p_new_role in schema.sql & single_college_migration.sql)
    let updated = false;
    let lastRpcErr: any = null;

    const { error: rpcErr1 } = await db.rpc('assign_college_admin_role', {
      p_target_user_id: targetUserId,
      p_new_role: newRole,
    });

    if (!rpcErr1) {
      updated = true;
    } else {
      lastRpcErr = rpcErr1;
      // Fallback for any legacy deployment with unprefixed parameter names
      const { error: rpcErr2 } = await db.rpc('assign_college_admin_role', {
        target_user_id: targetUserId,
        new_role: newRole,
      });
      if (!rpcErr2) {
        updated = true;
      } else {
        lastRpcErr = rpcErr2;
      }
    }

    if (!updated) {
      const updateClient = serviceSupabase || db;
      const { data: updRows, error: updErr } = await updateWithColumnPruning(
        updateClient,
        'profiles',
        'id',
        targetUserId,
        {
          role: newRole,
          college_id: collegeId,
          updated_at: new Date().toISOString(),
        }
      );

      if (updErr || !updRows || updRows.length === 0) {
        return res.status(500).json({
          error: 'Role update failed. Run supabase/single_college_migration.sql or configure SUPABASE_SERVICE_ROLE_KEY.',
          details: updErr?.message || lastRpcErr?.message,
        });
      }
      updated = true;
    }

    if (updated) {
      try {
        await db.from('activity_logs').insert({
          college_id: collegeId,
          actor_id: user.id,
          action: newRole === 'college_admin' ? 'ADMIN_ROLE_ASSIGNED' : 'ADMIN_ROLE_REVOKED',
          entity_type: 'PROFILE',
          entity_id: targetUserId,
          metadata: {
            target_email: targetProfile.email,
            target_name: targetProfile.full_name,
            previous_role: targetProfile.role,
            new_role: newRole,
            actor_email: profile.email,
          },
        });
      } catch (logErr) {
        console.warn('[POST /api/admin/assign-admin] Activity log skipped:', logErr);
      }
    }

    return res.json({
      success: true,
      message:
        newRole === 'college_admin'
          ? `${targetProfile.full_name || targetProfile.email} is now a College Admin.`
          : `${targetProfile.full_name || targetProfile.email} has been reassigned to Student.`,
    });
  } catch (err: any) {
    console.error('[POST /api/admin/assign-admin]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to update user role.' });
  }
});

// =========================================================================
// COLLEGE ADMIN PERSONAL PROFILE UPDATE (College Admin Only)
// =========================================================================
app.post('/api/admin/profile', async (req, res) => {
  try {
    const { user, profile, db, collegeId } = await authenticateAdmin(req);
    const {
      full_name,
      phone,
      avatar_url,
      designation,
      department,
      staff_id,
      office_room,
      bio,
    } = req.body || {};

    const trimmedName = typeof full_name === 'string' ? full_name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Administrator full name is required.' });
    }

    const sanitizedAvatarUrl =
      typeof avatar_url === 'string'
        ? avatar_url.trim().startsWith('[SUSPENDED]')
          ? profile.avatar_url || null
          : avatar_url.trim() || null
        : profile.avatar_url || null;

    const updatePayload: Record<string, any> = {
      full_name: trimmedName,
      phone: typeof phone === 'string' ? phone.trim() : profile.phone || '',
      avatar_url: sanitizedAvatarUrl,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedRows, error: updateErr } = await updateWithColumnPruning(
      db,
      'profiles',
      'id',
      user.id,
      updatePayload
    );

    if (updateErr) {
      console.error('[POST /api/admin/profile] DB update error:', updateErr);
      return res.status(500).json({
        error: 'Failed to update administrator profile.',
        details: updateErr.message,
      });
    }

    const updatedProfile = updatedRows && updatedRows[0] ? updatedRows[0] : null;

    // Sync rich staff metadata to auth.users when service key is available
    if (serviceSupabase) {
      try {
        const nextMeta = {
          ...(user.user_metadata || {}),
          full_name: trimmedName,
          designation:
            typeof designation === 'string'
              ? designation.trim()
              : user.user_metadata?.designation || '',
          department:
            typeof department === 'string'
              ? department.trim()
              : user.user_metadata?.department || '',
          staff_id:
            typeof staff_id === 'string' ? staff_id.trim() : user.user_metadata?.staff_id || '',
          office_room:
            typeof office_room === 'string'
              ? office_room.trim()
              : user.user_metadata?.office_room || '',
          bio: typeof bio === 'string' ? bio.trim() : user.user_metadata?.bio || '',
        };
        await serviceSupabase.auth.admin.updateUserById(user.id, {
          user_metadata: nextMeta,
        });
      } catch (metaErr) {
        console.warn('[POST /api/admin/profile] user_metadata sync skipped:', metaErr);
      }
    }

    try {
      await db.from('activity_logs').insert({
        college_id: collegeId,
        actor_id: user.id,
        action: 'ADMIN_PROFILE_UPDATED',
        entity_type: 'PROFILE',
        entity_id: user.id,
        metadata: {
          full_name: trimmedName,
          designation: typeof designation === 'string' ? designation.trim() : undefined,
          department: typeof department === 'string' ? department.trim() : undefined,
          admin_email: profile.email,
        },
      });
    } catch (logErr) {
      console.warn('[POST /api/admin/profile] activity log skipped:', logErr);
    }

    return res.json({
      success: true,
      profile: updatedProfile || { ...profile, ...updatePayload },
    });
  } catch (err: any) {
    console.error('[POST /api/admin/profile]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to update administrator profile.' });
  }
});

// =========================================================================
// COLLEGE IDENTITY & OFFICE SETTINGS UPDATE (College Admin Only)
// =========================================================================
app.post('/api/admin/college-settings', async (req, res) => {
  try {
    const { user, profile, db, collegeId } = await authenticateAdmin(req);
    const {
      college_name,
      college_code,
      city,
      state,
      office_name,
      office_location,
      office_hours,
      contact_email,
      contact_phone,
      pickup_instructions,
    } = req.body || {};

    // 1. Update university / campus identity in public.colleges if supplied
    if (collegeId && (typeof college_name === 'string' || typeof college_code === 'string')) {
      const nextName = typeof college_name === 'string' ? college_name.trim() : '';
      const nextCode = typeof college_code === 'string' ? college_code.trim().toUpperCase() : '';

      if (nextName) {
        const collegeUpdate: Record<string, any> = {
          name: nextName,
        };
        if (nextCode) collegeUpdate.code = nextCode;
        if (typeof city === 'string') collegeUpdate.city = city.trim() || null;
        if (typeof state === 'string') collegeUpdate.state = state.trim() || null;

        const { data: updatedColleges, error: colErr } = await updateWithColumnPruning(
          db,
          'colleges',
          'id',
          collegeId,
          collegeUpdate
        );

        if (colErr) {
          console.error('[POST /api/admin/college-settings] colleges update error:', colErr);
          const isDuplicateCode =
            colErr.code === '23505' || /duplicate key/i.test(colErr.message || '');
          return res.status(isDuplicateCode ? 409 : 500).json({
            error: isDuplicateCode
              ? `Campus code "${nextCode}" is already in use by another college record.`
              : 'Failed to update university name or campus code.',
            details: colErr.message,
          });
        }

        if (!updatedColleges || updatedColleges.length === 0) {
          return res.status(403).json({
            error: 'Permission denied updating university record in Supabase.',
            details:
              'Ensure the College Admin UPDATE policy on public.colleges is active (run supabase/single_college_migration.sql or set SUPABASE_SERVICE_ROLE_KEY).',
          });
        }
      }
    }

    // 2. Save Lost & Found office & handover configuration in public.app_config (UPDATE-first for RLS compatibility)
    const officeFields: Record<string, any> = {
      college_id: collegeId,
      office_name: String(office_name || DEFAULT_OFFICE.office_name).trim(),
      office_location: String(office_location || DEFAULT_OFFICE.office_location).trim(),
      office_hours: String(office_hours || DEFAULT_OFFICE.office_hours).trim(),
      contact_email: String(contact_email || DEFAULT_OFFICE.contact_email).trim(),
      contact_phone: String(contact_phone || '').trim(),
      pickup_instructions: String(
        pickup_instructions || DEFAULT_OFFICE.pickup_instructions
      ).trim(),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedConfigRows, error: updateCfgErr } = await updateWithColumnPruning(
      db,
      'app_config',
      'id',
      1,
      officeFields
    );

    if (updateCfgErr) {
      console.error('[POST /api/admin/college-settings] app_config update error:', updateCfgErr);
      return res.status(500).json({
        error: 'Failed to update campus office configuration.',
        details: updateCfgErr.message,
      });
    }

    // If app_config row id=1 did not exist yet, insert it
    if (!updatedConfigRows || updatedConfigRows.length === 0) {
      const { error: insertCfgErr } = await insertWithColumnPruning(db, 'app_config', {
        id: 1,
        ...officeFields,
      });
      if (insertCfgErr) {
        console.error('[POST /api/admin/college-settings] app_config insert error:', insertCfgErr);
        return res.status(500).json({
          error: 'Failed to initialize campus office configuration.',
          details: insertCfgErr.message,
        });
      }
    }

    try {
      await db.from('activity_logs').insert({
        college_id: collegeId,
        actor_id: user.id,
        action: 'COLLEGE_SETTINGS_UPDATED',
        entity_type: 'COLLEGE',
        entity_id: collegeId,
        metadata: {
          college_name: typeof college_name === 'string' ? college_name.trim() : undefined,
          office_location: officeFields.office_location,
          admin_email: profile.email,
        },
      });
    } catch (logErr) {
      console.warn('[POST /api/admin/college-settings] activity log skipped:', logErr);
    }

    const updatedCollege = await getConfiguredCollege(db);
    return res.json({ success: true, settings: { id: 1, ...officeFields }, college: updatedCollege });
  } catch (err: any) {
    console.error('[POST /api/admin/college-settings]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to save campus office settings.' });
  }
});

// =========================================================================
// COLLEGE ADMIN EXCEL EXPORT (.xlsx) — SAFE SANITIZED WORKBOOK
// =========================================================================
app.get('/api/admin/export-excel', async (req, res) => {
  try {
    const { user, profile, db, collegeId, configuredCollege } = await authenticateAdmin(req);

    const range = typeof req.query.range === 'string' ? req.query.range : 'all';
    let cutoffIso: string | null = null;
    const now = Date.now();
    if (range === '7d') cutoffIso = new Date(now - 7 * 86400000).toISOString();
    else if (range === '30d') cutoffIso = new Date(now - 30 * 86400000).toISOString();
    else if (range === '90d') cutoffIso = new Date(now - 90 * 86400000).toISOString();

    let itemsQuery = db
      .from('items')
      .select('*')
      .eq('college_id', collegeId)
      .order('created_at', { ascending: false });

    let claimsQuery = db
      .from('claims')
      .select('*, items(item_name, category), profiles:claimant_id(full_name, email)')
      .eq('college_id', collegeId)
      .order('created_at', { ascending: false });

    if (cutoffIso) {
      itemsQuery = itemsQuery.gte('created_at', cutoffIso);
      claimsQuery = claimsQuery.gte('created_at', cutoffIso);
    }

    const [{ data: itemsData, error: itemsErr }, { data: claimsData, error: claimsErr }, { data: usersData, error: usersErr }] =
      await Promise.all([
        itemsQuery,
        claimsQuery,
        db
          .from('profiles')
          .select('id, full_name, email, role, created_at')
          .eq('college_id', collegeId)
          .in('role', ['student', 'college_admin', 'STUDENT', 'COLLEGE_ADMIN'])
          .order('created_at', { ascending: false }),
      ]);

    if (itemsErr || claimsErr || usersErr) {
      return res.status(500).json({
        error: 'Failed to gather campus export dataset.',
        details: itemsErr?.message || claimsErr?.message || usersErr?.message,
      });
    }

    const items = itemsData || [];
    const claims = claimsData || [];
    const members = usersData || [];

    const lostItems = items.filter((i: any) => (i.type || '').toLowerCase() === 'lost');
    const foundItems = items.filter((i: any) => (i.type || '').toLowerCase() === 'found');
    const returnedItems = items.filter((i: any) => (i.status || '').toLowerCase() === 'returned');

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryRows = [
      { Metric: 'College Name', Value: configuredCollege?.name || 'Configured Campus' },
      { Metric: 'College Code', Value: configuredCollege?.code || 'N/A' },
      { Metric: 'Export Range', Value: range.toUpperCase() },
      { Metric: 'Generated At (UTC)', Value: new Date().toISOString() },
      { Metric: 'Total Registered Students', Value: members.filter((m: any) => m.role === 'student').length },
      { Metric: 'Total College Admins', Value: members.filter((m: any) => m.role === 'college_admin').length },
      { Metric: 'Total Lost Reports', Value: lostItems.length },
      { Metric: 'Total Found Reports', Value: foundItems.length },
      { Metric: 'Total Claims', Value: claims.length },
      { Metric: 'Successful Returns', Value: returnedItems.length },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    // Sheet 2: Lost Reports (sanitized — no unique_marks or private tokens)
    const lostSheetRows = lostItems.map((i: any) => ({
      'Report ID': i.id,
      'Item Name': i.item_name,
      Category: i.category,
      Brand: i.brand || '',
      Color: i.color || '',
      Location: i.location,
      'Date Lost': i.date,
      Status: (i.status || '').toUpperCase(),
      'Created At': i.created_at,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(lostSheetRows.length ? lostSheetRows : [{ Info: 'No lost reports in range' }]),
      'Lost Reports'
    );

    // Sheet 3: Found Reports (sanitized)
    const foundSheetRows = foundItems.map((i: any) => ({
      'Report ID': i.id,
      'Item Name': i.item_name,
      Category: i.category,
      Brand: i.brand || '',
      Color: i.color || '',
      Location: i.location,
      'Storage Location': i.current_storage_location || i.storage_location || '',
      'Date Found': i.date,
      Status: (i.status || '').toUpperCase(),
      'Returned At': i.returned_at || '',
      'Created At': i.created_at,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(foundSheetRows.length ? foundSheetRows : [{ Info: 'No found reports in range' }]),
      'Found Reports'
    );

    // Sheet 4: Claims (strictly omits private proof URLs/paths & sensitive explanations)
    const claimsSheetRows = claims.map((c: any) => {
      const claimant = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      const itemRef = Array.isArray(c.items) ? c.items[0] : c.items;
      return {
        'Claim ID': c.id,
        'Item Name': itemRef?.item_name || '',
        Category: itemRef?.category || '',
        Claimant: claimant?.full_name || 'Student',
        Status: (c.status || '').toUpperCase(),
        'Lost Date': c.lost_date || '',
        'Lost Location': c.lost_location || '',
        'Handover At': c.handover_at || '',
        'Completed At': c.completed_at || '',
        'Created At': c.created_at,
      };
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(claimsSheetRows.length ? claimsSheetRows : [{ Info: 'No claims in range' }]),
      'Claims'
    );

    // Sheet 5: Campus Directory (name, role, joined date — no passwords/tokens/phone)
    const directoryRows = members.map((m: any) => ({
      'User ID': m.id,
      'Full Name': m.full_name || '',
      Email: m.email || '',
      Role: m.role === 'college_admin' ? 'College Admin' : 'Student',
      'Joined At': m.created_at,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(directoryRows.length ? directoryRows : [{ Info: 'No users found' }]),
      'Campus Directory'
    );

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    try {
      await db.from('activity_logs').insert({
        college_id: collegeId,
        actor_id: user.id,
        action: 'REPORTS_EXPORTED',
        entity_type: 'EXPORT',
        metadata: {
          format: 'xlsx',
          range,
          items_count: items.length,
          claims_count: claims.length,
          admin_email: profile.email,
        },
      });
    } catch (logErr) {
      console.warn('[Export Excel] Activity log skipped:', logErr);
    }

    const dateStamp = new Date().toISOString().split('T')[0];
    const filename = `foundly-campus-report-${range}-${dateStamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[GET /api/admin/export-excel]', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Failed to generate Excel report.' });
  }
});

// =========================================================================
// VITE MIDDLEWARE & STATIC PRODUCTION SERVER
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Foundly single-college server running on http://localhost:${PORT}`);

    // Non-blocking startup reconciliation so already-published Lost & Found items match automatically
    if (serviceSupabase && ai && !isBackgroundScanRunning) {
      isBackgroundScanRunning = true;
      setTimeout(async () => {
        try {
          const college = await getConfiguredCollege(serviceSupabase);
          if (college?.id) {
            const scanRes = await runAutomaticMatching({
              db: serviceSupabase,
              collegeId: college.id,
              maxPairs: 10,
            });
            if (scanRes.pairsEvaluated > 0 || scanRes.matchesCreated > 0) {
              console.log(
                `[Startup AI Matching] Evaluated ${scanRes.pairsEvaluated} pair(s), created ${scanRes.matchesCreated} match(es).`
              );
            }
          }
        } catch (err: any) {
          console.warn('[Startup AI Matching] Skipped:', err?.message || err);
        } finally {
          isBackgroundScanRunning = false;
        }
      }, 2500);
    }
  });
}

startServer();
