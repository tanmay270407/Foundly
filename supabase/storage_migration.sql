-- =========================================================
-- FOUNDLY STORAGE BUCKETS & POLICIES MIGRATION SCRIPT
-- =========================================================

-- 1. CREATE BUCKETS (SAFE INSERT - DOES NOT DESTRUCT PRE-EXISTING FILES)
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-proofs', 'claim-proofs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-proofs', 'admin-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. CLEANUP EXISTING/CONFLICTING STORAGE POLICIES
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

-- 3. APPLY HARDENED FOUNDLY STORAGE POLICIES (OWNER_ID STANDARDS)

-- --- A. ITEM IMAGES POLICIES ---
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

-- --- B. CLAIM PROOFS POLICIES ---
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

-- --- C. ADMIN PROOFS POLICIES ---
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
