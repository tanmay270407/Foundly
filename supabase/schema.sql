-- =========================================================
-- FOUNDLY SECURE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Single-College Lost & Found Management System
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- PART 1: CORE TABLES
-- =========================================================

-- 1. COLLEGES TABLE (Retained for relational integrity & configured single campus)
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  domain TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. APP_CONFIG TABLE (Trusted Single-College Configuration)
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  office_name TEXT NOT NULL DEFAULT 'Galgotias University Lost & Found Office',
  office_location TEXT NOT NULL DEFAULT 'Block A, Ground Floor, Campus Security & Student Welfare Desk, Galgotias University',
  office_hours TEXT NOT NULL DEFAULT 'Monday – Saturday, 9:00 AM – 5:00 PM',
  contact_email TEXT NOT NULL DEFAULT 'lostandfound@galgotiasuniversity.edu.in',
  contact_phone TEXT DEFAULT '+91-120-4370000',
  pickup_instructions TEXT NOT NULL DEFAULT 'Bring your valid Galgotias University Student ID card and claim reference ID to verify ownership before collecting approved items.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROFILES TABLE (Linked to auth.users; active roles: student, college_admin)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  college_id UUID REFERENCES colleges(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'college_admin')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ITEMS TABLE (Lost & Found)
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
  storage_location TEXT,
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

-- 5. CLAIMS TABLE
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  lost_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  match_id UUID REFERENCES item_matches(id) ON DELETE SET NULL,
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
  status TEXT NOT NULL DEFAULT 'SUGGESTED' CHECK (status IN ('SUGGESTED', 'DISMISSED', 'CLAIMED', 'VERIFIED', 'NOT_A_MATCH', 'suggested', 'dismissed', 'claimed', 'verified', 'not_a_match')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_lost_found UNIQUE (lost_item_id, found_item_id)
);

-- =========================================================
-- PART 2: SECURITY DEFINER FUNCTIONS
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
  SELECT college_id INTO v_college_id FROM public.app_config WHERE id = 1;
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
  SELECT college_id INTO v_college_id FROM public.profiles WHERE id = auth.uid();
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
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF LOWER(v_role) = 'foundly_owner' THEN
    RETURN 'unauthorized_retired_owner';
  END IF;
  RETURN LOWER(v_role);
END;
$$;

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
  SET role = p_new_role, updated_at = now()
  WHERE id = p_target_user_id AND college_id = v_configured_college;
END;
$$;

-- =========================================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_matches ENABLE ROW LEVEL SECURITY;

-- APP_CONFIG
CREATE POLICY "Public read access to app_config" ON app_config FOR SELECT USING (true);
CREATE POLICY "College admins can insert app_config" ON app_config FOR INSERT WITH CHECK (get_my_role() = 'college_admin');
CREATE POLICY "College admins can update app_config" ON app_config FOR UPDATE USING (get_my_role() = 'college_admin');

-- COLLEGES
CREATE POLICY "Public read access to colleges" ON colleges FOR SELECT USING (id = get_configured_college_id());
CREATE POLICY "College admin can update configured college" ON colleges FOR UPDATE USING (id = get_configured_college_id() AND get_my_role() = 'college_admin');

-- PROFILES
CREATE POLICY "Users view own profile or admin views college profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR (get_my_role() = 'college_admin' AND college_id = get_configured_college_id())
  );

CREATE POLICY "Users can create their own student profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND LOWER(role) = 'student'
    AND college_id = get_configured_college_id()
  );

CREATE POLICY "Users can update their own profile fields" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "College admin can update college profiles" ON profiles FOR UPDATE USING (get_my_role() = 'college_admin' AND college_id = get_configured_college_id());

-- ITEMS
CREATE POLICY "Students view approved/published items or own reports" ON items
  FOR SELECT USING (
    college_id = get_configured_college_id()
    AND (get_my_role() = 'college_admin' OR user_id = auth.uid() OR status IN ('published', 'approved'))
  );

CREATE POLICY "Users can insert items for their college" ON items
  FOR INSERT WITH CHECK (get_my_role() IN ('student', 'college_admin') AND college_id = get_configured_college_id() AND user_id = auth.uid());

CREATE POLICY "Users can update their own reports" ON items FOR UPDATE USING (user_id = auth.uid() AND get_my_role() IN ('student', 'college_admin'));
CREATE POLICY "Admins can update items in their college" ON items FOR UPDATE USING (college_id = get_configured_college_id() AND get_my_role() = 'college_admin');

-- CLAIMS
CREATE POLICY "Students see own claims; Admins see college claims" ON claims
  FOR SELECT USING (college_id = get_configured_college_id() AND (claimant_id = auth.uid() OR get_my_role() = 'college_admin'));

CREATE POLICY "Students can submit claim for items in their college" ON claims
  FOR INSERT WITH CHECK (
    get_my_role() IN ('student', 'college_admin')
    AND claimant_id = auth.uid()
    AND college_id = get_configured_college_id()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM items i
      WHERE i.id = item_id AND LOWER(i.type) = 'found' AND LOWER(i.status) IN ('published', 'approved') AND i.college_id = get_configured_college_id()
    )
  );

CREATE POLICY "Admins can update claims for their college" ON claims FOR UPDATE USING (college_id = get_configured_college_id() AND get_my_role() = 'college_admin');

-- NOTIFICATIONS
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications read status" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Authenticated users can insert college notifications" ON notifications FOR INSERT WITH CHECK (get_my_role() IN ('student', 'college_admin') AND college_id = get_configured_college_id());

-- ACTIVITY LOGS
CREATE POLICY "Admins see college activity" ON activity_logs FOR SELECT USING (college_id = get_configured_college_id() AND get_my_role() IN ('student', 'college_admin'));
CREATE POLICY "Authenticated users can insert activity logs" ON activity_logs FOR INSERT WITH CHECK (get_my_role() IN ('student', 'college_admin') AND college_id = get_configured_college_id());

-- ITEM MATCHES
CREATE POLICY "Students see own match suggestions" ON item_matches
  FOR SELECT USING (
    college_id = get_configured_college_id()
    AND (get_my_role() = 'college_admin' OR EXISTS (SELECT 1 FROM items i WHERE (i.id = lost_item_id OR i.id = found_item_id) AND i.user_id = auth.uid()))
  );

CREATE POLICY "Admins can insert match suggestions for their college" ON item_matches
  FOR INSERT WITH CHECK (
    college_id = get_configured_college_id()
    AND get_my_role() = 'college_admin'
  );

CREATE POLICY "Admins can update match suggestions for their college" ON item_matches
  FOR UPDATE USING (
    college_id = get_configured_college_id()
    AND (get_my_role() = 'college_admin' OR EXISTS (SELECT 1 FROM items i WHERE (i.id = lost_item_id OR i.id = found_item_id) AND i.user_id = auth.uid()))
  );

-- =========================================================
-- PART 4: SECURITY TRIGGERS
-- =========================================================

CREATE OR REPLACE FUNCTION public.preserve_profile_fields_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_preserve_profile_fields ON profiles;
CREATE TRIGGER trg_preserve_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_profile_fields_on_update();

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

-- =========================================================
-- PART 5: INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_items_college_id ON items(college_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_item_id ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_lost_item_id ON claims(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant_id ON claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_college_id ON claims(college_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_college_id ON activity_logs(college_id);
CREATE INDEX IF NOT EXISTS idx_item_matches_college_id ON item_matches(college_id);
