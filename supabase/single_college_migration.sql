-- =========================================================
-- FOUNDLY — NON-DESTRUCTIVE SINGLE-COLLEGE MIGRATION SCRIPT
-- =========================================================
-- Safe, idempotent migration from Multi-College + Owner Portal
-- to Single-College Student & College Admin Architecture.
--
-- IMPORTANT:
-- - Does NOT delete student accounts, items, claims, notifications, or logs.
-- - Creates reversible backup snapshots before updating records.
-- - Preserves `college_id` columns for relational integrity and RLS.
-- - Discontinues Owner Portal access (`foundly_owner` cannot access app/RLS).
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- STEP 1: NON-DESTRUCTIVE BACKUP SNAPSHOTS
-- =========================================================
CREATE SCHEMA IF NOT EXISTS backup_pre_single_college;

CREATE TABLE IF NOT EXISTS backup_pre_single_college.colleges_backup AS
  SELECT *, now() AS backed_up_at FROM public.colleges WHERE false;

CREATE TABLE IF NOT EXISTS backup_pre_single_college.profiles_backup AS
  SELECT *, now() AS backed_up_at FROM public.profiles WHERE false;

CREATE TABLE IF NOT EXISTS backup_pre_single_college.archived_owner_accounts AS
  SELECT id, full_name, email, college_id, role, created_at, now() AS archived_at
  FROM public.profiles WHERE false;

CREATE TABLE IF NOT EXISTS backup_pre_single_college.archived_admin_requests AS
  SELECT *, now() AS archived_at
  FROM public.admin_requests WHERE false;

-- Snapshot current colleges once (if backup is empty)
INSERT INTO backup_pre_single_college.colleges_backup
SELECT c.*, now()
FROM public.colleges c
WHERE NOT EXISTS (SELECT 1 FROM backup_pre_single_college.colleges_backup);

-- Snapshot current profiles once (if backup is empty)
INSERT INTO backup_pre_single_college.profiles_backup
SELECT p.*, now()
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM backup_pre_single_college.profiles_backup);

-- Archive any existing foundly_owner accounts safely
INSERT INTO backup_pre_single_college.archived_owner_accounts
SELECT id, full_name, email, college_id, role, created_at, now()
FROM public.profiles p
WHERE LOWER(p.role) = 'foundly_owner'
  AND NOT EXISTS (
    SELECT 1 FROM backup_pre_single_college.archived_owner_accounts a WHERE a.id = p.id
  );

-- Archive any existing admin_requests records safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_requests'
  ) THEN
    INSERT INTO backup_pre_single_college.archived_admin_requests
    SELECT r.*, now()
    FROM public.admin_requests r
    WHERE NOT EXISTS (
      SELECT 1 FROM backup_pre_single_college.archived_admin_requests a WHERE a.id = r.id
    );
  END IF;
END $$;


-- =========================================================
-- STEP 2: TRUSTED SINGLE-COLLEGE CONFIGURATION (`app_config`)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE RESTRICT,
  office_name TEXT NOT NULL DEFAULT 'Campus Lost & Found Office',
  office_location TEXT NOT NULL DEFAULT 'Main Campus Security Desk, Room 101',
  office_hours TEXT NOT NULL DEFAULT 'Monday – Friday, 9:00 AM – 5:00 PM',
  contact_email TEXT NOT NULL DEFAULT 'lostandfound@college.edu',
  contact_phone TEXT DEFAULT '',
  pickup_instructions TEXT NOT NULL DEFAULT 'Bring your valid Student ID card to verify ownership before collecting approved items.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure at least one official college exists, and link app_config(id=1) to it
DO $$
DECLARE
  v_primary_college_id UUID;
BEGIN
  -- Prefer an existing non-deactivated college, otherwise the oldest existing college
  SELECT id INTO v_primary_college_id
  FROM public.colleges
  ORDER BY
    CASE WHEN COALESCE(domain, '') NOT LIKE '[DEACTIVATED]%' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  -- If no college exists at all, create the default official campus record
  IF v_primary_college_id IS NULL THEN
    INSERT INTO public.colleges (name, code)
    VALUES ('Official Campus', 'CAMPUS')
    RETURNING id INTO v_primary_college_id;
  END IF;

  -- Normalize domain prefix if previously marked [DEACTIVATED]
  UPDATE public.colleges
  SET domain = NULLIF(REPLACE(domain, '[DEACTIVATED]', ''), '')
  WHERE id = v_primary_college_id AND domain LIKE '[DEACTIVATED]%';

  -- Insert singleton app_config row if missing
  INSERT INTO public.app_config (id, college_id)
  VALUES (1, v_primary_college_id)
  ON CONFLICT (id) DO NOTHING;
END $$;


-- =========================================================
-- STEP 3: SAFELY ASSIGN EXISTING RECORDS TO CONFIGURED COLLEGE
-- =========================================================
DO $$
DECLARE
  v_college_id UUID;
BEGIN
  SELECT college_id INTO v_college_id FROM public.app_config WHERE id = 1;

  IF v_college_id IS NOT NULL THEN
    -- Assign all student & college_admin profiles to the configured official college
    UPDATE public.profiles
    SET college_id = v_college_id,
        updated_at = now()
    WHERE LOWER(role) IN ('student', 'college_admin')
      AND (college_id IS NULL OR college_id <> v_college_id);

    -- Align items, claims, notifications, activity_logs, item_matches to the configured college
    -- so no historical records are orphaned or hidden after single-college consolidation
    UPDATE public.items SET college_id = v_college_id WHERE college_id IS DISTINCT FROM v_college_id;
    UPDATE public.claims SET college_id = v_college_id WHERE college_id IS DISTINCT FROM v_college_id;
    UPDATE public.notifications SET college_id = v_college_id WHERE college_id IS DISTINCT FROM v_college_id;
    UPDATE public.activity_logs SET college_id = v_college_id WHERE college_id IS DISTINCT FROM v_college_id;
    UPDATE public.item_matches SET college_id = v_college_id WHERE college_id IS DISTINCT FROM v_college_id;
  END IF;
END $$;


-- =========================================================
-- STEP 4: SECURITY DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_configured_college_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_college_id UUID;
BEGIN
  SELECT college_id INTO v_college_id
  FROM public.app_config
  WHERE id = 1;
  RETURN v_college_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_college_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_college_id UUID;
BEGIN
  SELECT college_id INTO v_college_id
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_college_id, public.get_configured_college_id());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();
  -- Retired foundly_owner role receives no administrative privileges
  IF LOWER(v_role) = 'foundly_owner' THEN
    RETURN 'unauthorized_retired_owner';
  END IF;
  RETURN LOWER(v_role);
END;
$$;


-- =========================================================
-- STEP 5: TRUSTED ADMIN ROLE ASSIGNMENT HELPER
-- =========================================================
-- Used only by an authorized college_admin (never by students)
-- via authenticated server/RPC call.
CREATE OR REPLACE FUNCTION public.assign_college_admin_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_college UUID;
  v_target_college UUID;
  v_configured_college UUID;
  v_admin_count INTEGER;
BEGIN
  v_caller_role := public.get_my_role();
  IF v_caller_role <> 'college_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only an active College Admin can assign admin roles.';
  END IF;

  IF p_new_role NOT IN ('student', 'college_admin') THEN
    RAISE EXCEPTION 'Invalid role. Allowed roles: student, college_admin.';
  END IF;

  v_configured_college := public.get_configured_college_id();
  SELECT college_id INTO v_caller_college FROM public.profiles WHERE id = auth.uid();
  SELECT college_id INTO v_target_college FROM public.profiles WHERE id = p_target_user_id;

  IF v_caller_college IS DISTINCT FROM v_configured_college OR v_target_college IS DISTINCT FROM v_configured_college THEN
    RAISE EXCEPTION 'Forbidden: Target user does not belong to the configured college.';
  END IF;

  IF p_target_user_id = auth.uid() AND p_new_role <> 'college_admin' THEN
    RAISE EXCEPTION 'You cannot revoke your own administrator role.';
  END IF;

  IF p_new_role = 'student' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public.profiles
    WHERE college_id = v_configured_college AND LOWER(role) = 'college_admin';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last remaining College Administrator.';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = p_new_role,
      updated_at = now()
  WHERE id = p_target_user_id;
END;
$$;


-- =========================================================
-- STEP 6: UPDATED SINGLE-COLLEGE RLS POLICIES (NO OWNER BYPASS)
-- =========================================================
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_matches ENABLE ROW LEVEL SECURITY;

-- Drop legacy multi-college & owner policies
DROP POLICY IF EXISTS "Public read access to app_config" ON public.app_config;
DROP POLICY IF EXISTS "College admins can insert app_config" ON public.app_config;
DROP POLICY IF EXISTS "College admins can update app_config" ON public.app_config;

DROP POLICY IF EXISTS "Public read access to colleges" ON public.colleges;
DROP POLICY IF EXISTS "Only Foundly Owner can insert or modify colleges" ON public.colleges;
DROP POLICY IF EXISTS "College admin can update configured college" ON public.colleges;

DROP POLICY IF EXISTS "Users view own or same-college profiles, Owner views all" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or admin views college profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own student profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Foundly Owner can update any profile role or college" ON public.profiles;
DROP POLICY IF EXISTS "College admin can update college profiles" ON public.profiles;

DROP POLICY IF EXISTS "Students view approved/published items or own reports" ON public.items;
DROP POLICY IF EXISTS "Users can insert items for their college" ON public.items;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.items;
DROP POLICY IF EXISTS "Admins can update items in their college" ON public.items;

DROP POLICY IF EXISTS "Students see own claims; Admins see college claims" ON public.claims;
DROP POLICY IF EXISTS "Students can submit claim for items in their college" ON public.claims;
DROP POLICY IF EXISTS "Admins can update claims for their college" ON public.claims;

DROP POLICY IF EXISTS "Public insert for admin application" ON public.admin_requests;
DROP POLICY IF EXISTS "Applicants see own requests; Owner sees all" ON public.admin_requests;
DROP POLICY IF EXISTS "Only Foundly Owner can review admin requests" ON public.admin_requests;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications read status" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert college notifications" ON public.notifications;

DROP POLICY IF EXISTS "Admins see college activity; Owner sees all" ON public.activity_logs;
DROP POLICY IF EXISTS "College users can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;

DROP POLICY IF EXISTS "Students see own match suggestions" ON public.item_matches;
DROP POLICY IF EXISTS "Admins can insert match suggestions for their college" ON public.item_matches;
DROP POLICY IF EXISTS "Admins can update match suggestions for their college" ON public.item_matches;
DROP POLICY IF EXISTS "Users can dismiss their own match suggestions" ON public.item_matches;

-- --- APP_CONFIG ---
CREATE POLICY "Public read access to app_config" ON public.app_config
  FOR SELECT USING (true);

CREATE POLICY "College admins can insert app_config" ON public.app_config
  FOR INSERT WITH CHECK (public.get_my_role() = 'college_admin');

CREATE POLICY "College admins can update app_config" ON public.app_config
  FOR UPDATE USING (public.get_my_role() = 'college_admin');

-- --- COLLEGES ---
CREATE POLICY "Public read access to colleges" ON public.colleges
  FOR SELECT USING (id = public.get_configured_college_id());

CREATE POLICY "College admin can update configured college" ON public.colleges
  FOR UPDATE USING (
    id = public.get_configured_college_id()
    AND public.get_my_role() = 'college_admin'
  );

-- --- PROFILES ---
CREATE POLICY "Users view own profile or admin views college profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR (
      public.get_my_role() = 'college_admin'
      AND college_id = public.get_configured_college_id()
    )
  );

CREATE POLICY "Users can create their own student profile" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND LOWER(role) = 'student'
    AND college_id = public.get_configured_college_id()
  );

CREATE POLICY "Users can update their own profile fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "College admin can update college profiles" ON public.profiles
  FOR UPDATE USING (
    public.get_my_role() = 'college_admin'
    AND college_id = public.get_configured_college_id()
  );

-- --- ITEMS ---
CREATE POLICY "Students view approved/published items or own reports" ON public.items
  FOR SELECT USING (
    college_id = public.get_configured_college_id()
    AND (
      (public.get_my_role() = 'college_admin')
      OR user_id = auth.uid()
      OR status IN ('published', 'approved')
    )
  );

CREATE POLICY "Users can insert items for their college" ON public.items
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('student', 'college_admin')
    AND college_id = public.get_configured_college_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own reports" ON public.items
  FOR UPDATE USING (
    user_id = auth.uid()
    AND public.get_my_role() IN ('student', 'college_admin')
  );

CREATE POLICY "Admins can update items in their college" ON public.items
  FOR UPDATE USING (
    college_id = public.get_configured_college_id()
    AND public.get_my_role() = 'college_admin'
  );

-- --- CLAIMS ---
CREATE POLICY "Students see own claims; Admins see college claims" ON public.claims
  FOR SELECT USING (
    college_id = public.get_configured_college_id()
    AND (
      claimant_id = auth.uid()
      OR public.get_my_role() = 'college_admin'
    )
  );

CREATE POLICY "Students can submit claim for items in their college" ON public.claims
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('student', 'college_admin')
    AND claimant_id = auth.uid()
    AND college_id = public.get_configured_college_id()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = item_id
        AND LOWER(i.type) = 'found'
        AND LOWER(i.status) IN ('published', 'approved')
        AND i.college_id = public.get_configured_college_id()
    )
  );

CREATE POLICY "Admins can update claims for their college" ON public.claims
  FOR UPDATE USING (
    college_id = public.get_configured_college_id()
    AND public.get_my_role() = 'college_admin'
  );

-- --- ADMIN_REQUESTS (ARCHIVED & LOCKED DOWN) ---
-- Table retained safely for archival audit history; new submissions disabled.
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- --- NOTIFICATIONS ---
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications read status" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert college notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('student', 'college_admin')
    AND college_id = public.get_configured_college_id()
  );

-- --- ACTIVITY LOGS ---
CREATE POLICY "Admins see college activity" ON public.activity_logs
  FOR SELECT USING (
    college_id = public.get_configured_college_id()
    AND public.get_my_role() IN ('student', 'college_admin')
  );

CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('student', 'college_admin')
    AND college_id = public.get_configured_college_id()
  );

-- --- ITEM MATCHES ---
CREATE POLICY "Students see own match suggestions" ON public.item_matches
  FOR SELECT USING (
    college_id = public.get_configured_college_id()
    AND (
      public.get_my_role() = 'college_admin'
      OR EXISTS (
        SELECT 1 FROM public.items i
        WHERE (i.id = lost_item_id OR i.id = found_item_id)
          AND i.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can insert match suggestions for their college" ON public.item_matches
  FOR INSERT WITH CHECK (
    college_id = public.get_configured_college_id()
    AND public.get_my_role() = 'college_admin'
  );

CREATE POLICY "Admins can update match suggestions for their college" ON public.item_matches
  FOR UPDATE USING (
    college_id = public.get_configured_college_id()
    AND (
      public.get_my_role() = 'college_admin'
      OR EXISTS (
        SELECT 1 FROM public.items i
        WHERE (i.id = lost_item_id OR i.id = found_item_id)
          AND i.user_id = auth.uid()
      )
    )
  );

-- Optional linked Lost-to-Found claim columns (safe & non-destructive)
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS lost_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.item_matches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_claims_lost_item_id ON public.claims(lost_item_id);


-- =========================================================
-- STEP 7: UPDATED PROFILE PROTECTION TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.preserve_profile_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow privileged SQL Editor / service_role (auth.uid() IS NULL) and active college_admins
  -- Students and retired owners can NEVER escalate their own role or switch college_id
  IF auth.uid() IS NOT NULL AND LOWER(COALESCE(public.get_my_role(), '')) <> 'college_admin' THEN
    NEW.role := OLD.role;
    NEW.college_id := OLD.college_id;
  ELSE
    IF LOWER(COALESCE(NEW.role, '')) = 'foundly_owner' THEN
      RAISE EXCEPTION 'The foundly_owner role has been discontinued.';
    END IF;
    NEW.college_id := COALESCE(public.get_configured_college_id(), NEW.college_id);
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


-- =========================================================
-- STEP 8: STORAGE BUCKETS & SINGLE-COLLEGE POLICIES
-- =========================================================
DROP POLICY IF EXISTS "Foundly Claim Proof Read" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Admin Proof Upload" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Admin Proof Read" ON storage.objects;

CREATE POLICY "Foundly Claim Proof Read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'claim-proofs'
    AND (
      (auth.uid()::text = owner_id::text AND split_part(name, '/', 2) = auth.uid()::text)
      OR (public.get_my_role() = 'college_admin' AND split_part(name, '/', 1) = public.get_configured_college_id()::text)
    )
  );


-- =========================================================
-- STEP 9: INITIAL COLLEGE ADMIN BOOTSTRAP TEMPLATE
-- =========================================================
-- Ensure 'Admin27@gmail.com' is created in Supabase Auth, then run once
-- in Supabase SQL Editor to assign the college_admin role:
--
-- UPDATE public.profiles
-- SET role = 'college_admin',
--     college_id = public.get_configured_college_id(),
--     updated_at = now()
-- WHERE LOWER(email) = LOWER('Admin27@gmail.com');
