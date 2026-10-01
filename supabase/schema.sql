-- =========================================================
-- FOUNDLY SECURE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Multi-College Lost & Found Platform - Hardened Edition
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- PART 1: MIGRATION-SAFE TABLE CREATION (NON-DESTRUCTIVE)
-- =========================================================

-- 1. COLLEGES TABLE
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  college_id UUID REFERENCES colleges(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'college_admin', 'foundly_owner')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ITEMS TABLE (Lost & Found)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  color TEXT,
  unique_marks TEXT,
  date DATE,
  approximate_time TIME,
  location TEXT,
  image_path TEXT,
  current_storage_location TEXT,
  contact_preference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'claimed', 'under_verification', 'handover', 'returned', 'closed', 'under_review', 'completed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CLAIMS TABLE
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  claim_explanation TEXT NOT NULL,
  lost_date DATE,
  lost_location TEXT,
  identifying_details TEXT,
  ownership_proof_path TEXT,
  contact_information TEXT,
  additional_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'handover', 'completed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  handover_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  handover_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ADMIN_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS admin_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  college_proof_path TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ACTIVITY_LOGS TABLE
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. ITEM_MATCHES TABLE
CREATE TABLE IF NOT EXISTS item_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lost_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  found_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  match_score NUMERIC CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'dismissed', 'claimed', 'verified', 'not_a_match')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_lost_found UNIQUE (lost_item_id, found_item_id)
);


-- =========================================================
-- PART 2: SECURITY DEFINER FUNCTIONS (Prevents RLS Recursion)
-- =========================================================

-- Secure lookup for current user's college_id
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
  RETURN v_college_id;
END;
$$;

-- Secure lookup for current user's role
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
  RETURN LOWER(v_role);
END;
$$;


-- =========================================================
-- PART 3: CLEANUP & RECREATE ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_matches ENABLE ROW LEVEL SECURITY;

-- 1. DROP EXISTING POLICIES (MIGRATION SAFE)
DROP POLICY IF EXISTS "Public read access to colleges" ON colleges;
DROP POLICY IF EXISTS "Only Foundly Owner can insert or modify colleges" ON colleges;

DROP POLICY IF EXISTS "Users view own or same-college profiles, Owner views all" ON profiles;
DROP POLICY IF EXISTS "Users can create their own student profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile fields" ON profiles;
DROP POLICY IF EXISTS "Foundly Owner can update any profile role or college" ON profiles;

DROP POLICY IF EXISTS "Students view approved/published items or own reports" ON items;
DROP POLICY IF EXISTS "Users can insert items for their college" ON items;
DROP POLICY IF EXISTS "Users can update their own reports" ON items;
DROP POLICY IF EXISTS "Admins can update items in their college" ON items;

DROP POLICY IF EXISTS "Students see own claims; Admins see college claims" ON claims;
DROP POLICY IF EXISTS "Students can submit claim for items in their college" ON claims;
DROP POLICY IF EXISTS "Admins can update claims for their college" ON claims;

DROP POLICY IF EXISTS "Public insert for admin application" ON admin_requests;
DROP POLICY IF EXISTS "Applicants see own requests; Owner sees all" ON admin_requests;
DROP POLICY IF EXISTS "Only Foundly Owner can review admin requests" ON admin_requests;

DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users update own notifications read status" ON notifications;

DROP POLICY IF EXISTS "Admins see college activity; Owner sees all" ON activity_logs;

DROP POLICY IF EXISTS "Students see own match suggestions" ON item_matches;
DROP POLICY IF EXISTS "Authorized insertion of match suggestions" ON item_matches;
DROP POLICY IF EXISTS "Admins can update match suggestions for their college" ON item_matches;
DROP POLICY IF EXISTS "Users can dismiss their own match suggestions" ON item_matches;

-- 2. CREATE NEW POLICIES

-- --- COLLEGES ---
CREATE POLICY "Public read access to colleges" ON colleges
  FOR SELECT USING (true);

CREATE POLICY "Only Foundly Owner can insert or modify colleges" ON colleges
  FOR ALL USING (get_my_role() = 'foundly_owner');

-- --- PROFILES (WATERTIGHT: NO SELECT ON PROFILES) ---
CREATE POLICY "Users view own or same-college profiles, Owner views all" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR college_id = get_my_college_id()
    OR get_my_role() = 'foundly_owner'
  );

CREATE POLICY "Users can create their own student profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND LOWER(role) = 'student'
  );

CREATE POLICY "Users can update their own profile fields" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Foundly Owner can update any profile role or college" ON profiles
  FOR UPDATE USING (get_my_role() = 'foundly_owner');

-- --- ITEMS ---
CREATE POLICY "Students view approved/published items or own reports" ON items
  FOR SELECT USING (
    get_my_role() = 'foundly_owner'
    OR (college_id = get_my_college_id() AND get_my_role() = 'college_admin')
    OR user_id = auth.uid()
    OR (college_id = get_my_college_id() AND status IN ('published', 'approved'))
  );

CREATE POLICY "Users can insert items for their college" ON items
  FOR INSERT WITH CHECK (
    college_id = get_my_college_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own reports" ON items
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can update items in their college" ON items
  FOR UPDATE USING (
    (college_id = get_my_college_id() AND get_my_role() = 'college_admin')
    OR get_my_role() = 'foundly_owner'
  );

-- --- CLAIMS ---
CREATE POLICY "Students see own claims; Admins see college claims" ON claims
  FOR SELECT USING (
    claimant_id = auth.uid()
    OR (college_id = get_my_college_id() AND get_my_role() = 'college_admin')
    OR get_my_role() = 'foundly_owner'
  );

CREATE POLICY "Students can submit claim for items in their college" ON claims
  FOR INSERT WITH CHECK (
    get_my_role() = 'student'
    AND claimant_id = auth.uid()
    AND college_id = get_my_college_id()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM items i
      WHERE i.id = item_id
      AND i.type = 'found'
      AND i.status = 'published'
      AND i.college_id = get_my_college_id()
    )
  );

CREATE POLICY "Admins can update claims for their college" ON claims
  FOR UPDATE USING (
    (college_id = get_my_college_id() AND get_my_role() = 'college_admin')
    OR get_my_role() = 'foundly_owner'
  );

-- --- ADMIN REQUESTS ---
CREATE POLICY "Public insert for admin application" ON admin_requests
  FOR INSERT WITH CHECK (
    applicant_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Applicants see own requests; Owner sees all" ON admin_requests
  FOR SELECT USING (
    applicant_id = auth.uid()
    OR get_my_role() = 'foundly_owner'
  );

CREATE POLICY "Only Foundly Owner can review admin requests" ON admin_requests
  FOR UPDATE USING (get_my_role() = 'foundly_owner');

-- --- NOTIFICATIONS ---
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications read status" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- --- ACTIVITY LOGS ---
CREATE POLICY "Admins see college activity; Owner sees all" ON activity_logs
  FOR SELECT USING (
    (college_id = get_my_college_id() AND get_my_role() = 'college_admin')
    OR get_my_role() = 'foundly_owner'
  );

-- --- ITEM MATCHES ---
CREATE POLICY "Students see own match suggestions" ON item_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM items i 
      WHERE (i.id = lost_item_id OR i.id = found_item_id) 
      AND i.user_id = auth.uid()
    )
    OR (college_id = get_my_college_id() AND get_my_role() = 'college_admin')
    OR get_my_role() = 'foundly_owner'
  );


-- =========================================================
-- PART 4: SECURITY TRIGGERS (BYPASS-PROOF PROTECTION)
-- =========================================================

-- Trigger function: Enforce read-only profile columns
CREATE OR REPLACE FUNCTION public.preserve_profile_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(public.get_my_role()) <> 'foundly_owner' THEN
    NEW.role := OLD.role;
    NEW.college_id := OLD.college_id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_profile_fields ON profiles;
CREATE TRIGGER trg_preserve_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_profile_fields_on_update();


-- Trigger function: Enforce read-only item columns for students
CREATE OR REPLACE FUNCTION public.preserve_item_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(public.get_my_role()) = 'student' THEN
    NEW.status := OLD.status;
    NEW.user_id := OLD.user_id;
    NEW.college_id := OLD.college_id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_item_fields ON items;
CREATE TRIGGER trg_preserve_item_fields
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_item_fields_on_update();


-- Trigger function: Enforce read-only claim columns for students
CREATE OR REPLACE FUNCTION public.preserve_claim_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(public.get_my_role()) = 'student' THEN
    NEW.status := OLD.status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.college_id := OLD.college_id;
    NEW.claimant_id := OLD.claimant_id;
    NEW.completed_by := OLD.completed_by;
    NEW.completed_at := OLD.completed_at;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_claim_fields ON claims;
CREATE TRIGGER trg_preserve_claim_fields
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_claim_fields_on_update();


-- Trigger function: Enforce read-only admin_request columns on update
CREATE OR REPLACE FUNCTION public.preserve_admin_request_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(public.get_my_role()) <> 'foundly_owner' THEN
    NEW.status := OLD.status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.college_id := OLD.college_id;
    NEW.applicant_id := OLD.applicant_id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_admin_request_fields ON admin_requests;
CREATE TRIGGER trg_preserve_admin_request_fields
  BEFORE UPDATE ON admin_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_admin_request_fields_on_update();


-- Trigger function: Automatic student promotion on admin_request approval
CREATE OR REPLACE FUNCTION public.handle_admin_request_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.profiles
    SET role = 'college_admin',
        college_id = NEW.college_id
    WHERE id = NEW.applicant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_request_approval ON admin_requests;
CREATE TRIGGER trg_admin_request_approval
  AFTER UPDATE ON admin_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_request_approval();


-- Trigger function: Enforce read-only notification columns except 'read'
CREATE OR REPLACE FUNCTION public.preserve_notification_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.college_id := OLD.college_id;
  NEW.type := OLD.type;
  NEW.title := OLD.title;
  NEW.message := OLD.message;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_notification_fields ON notifications;
CREATE TRIGGER trg_preserve_notification_fields
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_notification_fields_on_update();


-- Trigger function: Strictly verify item matches share same college
CREATE OR REPLACE FUNCTION public.verify_item_match_colleges()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_lost_college_id UUID;
  v_found_college_id UUID;
BEGIN
  SELECT college_id INTO v_lost_college_id FROM public.items WHERE id = NEW.lost_item_id;
  SELECT college_id INTO v_found_college_id FROM public.items WHERE id = NEW.found_item_id;

  IF v_lost_college_id IS NULL OR v_found_college_id IS NULL THEN
    RAISE EXCEPTION 'Referenced lost or found items do not exist.';
  END IF;

  IF v_lost_college_id <> v_found_college_id OR v_lost_college_id <> NEW.college_id THEN
    RAISE EXCEPTION 'Matches can only be created between items of the same college.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_item_match_colleges ON item_matches;
CREATE TRIGGER trg_verify_item_match_colleges
  BEFORE INSERT OR UPDATE ON item_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_item_match_colleges();


-- =========================================================
-- PART 5: STORAGE BUCKETS & SECURITY POLICIES
-- =========================================================

-- Create buckets inside standard storage schema if missing
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-proofs', 'claim-proofs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-proofs', 'admin-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Dropping existing storage policies to reset them securely
DROP POLICY IF EXISTS "Public Read Access for Item Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Item Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Modify Own Item Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Claim Proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Select for Claim Proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Admin Proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Select for Admin Proofs" ON storage.objects;

DROP POLICY IF EXISTS "Foundly Item Images Upload" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Item Images Read" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Item Images Modify Own" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Claim Proof Upload" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Claim Proof Read" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Admin Proof Upload" ON storage.objects;
DROP POLICY IF EXISTS "Foundly Admin Proof Read" ON storage.objects;

-- --- 1. ITEM IMAGES POLICIES ---
CREATE POLICY "Foundly Item Images Read" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-images');

CREATE POLICY "Foundly Item Images Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = owner_id::text
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Foundly Item Images Modify Own" ON storage.objects
  FOR ALL USING (
    bucket_id = 'item-images'
    AND auth.uid()::text = owner_id::text
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- --- 2. CLAIM PROOFS POLICIES ---
CREATE POLICY "Foundly Claim Proof Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'claim-proofs'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = owner_id::text
    AND split_part(name, '/', 1) = get_my_college_id()::text
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Foundly Claim Proof Read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'claim-proofs'
    AND (
      (auth.uid()::text = owner_id::text AND split_part(name, '/', 2) = auth.uid()::text)
      OR (get_my_role() = 'college_admin' AND split_part(name, '/', 1) = get_my_college_id()::text)
      OR get_my_role() = 'foundly_owner'
    )
  );

-- --- 3. ADMIN PROOFS POLICIES ---
CREATE POLICY "Foundly Admin Proof Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'admin-proofs'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = owner_id::text
    AND split_part(name, '/', 1) = get_my_college_id()::text
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Foundly Admin Proof Read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'admin-proofs'
    AND (
      (auth.uid()::text = owner_id::text AND split_part(name, '/', 2) = auth.uid()::text)
      OR get_my_role() = 'foundly_owner'
    )
  );


-- =========================================================
-- PART 6: OPTIMIZED INDEXES (NON-DESTRUCTIVE)
-- =========================================================

-- Items indexes
CREATE INDEX IF NOT EXISTS idx_items_college_id ON items(college_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);

-- Claims indexes
CREATE INDEX IF NOT EXISTS idx_claims_item_id ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant_id ON claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_college_id ON claims(college_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Admin Requests indexes
CREATE INDEX IF NOT EXISTS idx_admin_requests_college_id ON admin_requests(college_id);
CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON admin_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_requests_one_pending_per_applicant 
  ON admin_requests (applicant_id) 
  WHERE status = 'pending' AND applicant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_requests_one_pending_per_email 
  ON admin_requests (LOWER(email)) 
  WHERE status = 'pending';

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_college_id ON notifications(college_id);

-- Activity Logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_college_id ON activity_logs(college_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON activity_logs(entity_id);

-- Item Matches indexes
CREATE INDEX IF NOT EXISTS idx_item_matches_college_id ON item_matches(college_id);
CREATE INDEX IF NOT EXISTS idx_item_matches_lost_item_id ON item_matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_item_matches_found_item_id ON item_matches(found_item_id);
