# Foundly — Campus Lost & Found System

> A secure, AI-assisted single-college Lost & Found management system for students and campus administrators.

## Overview

**Foundly** serves a single configured college with two role-based portals:

1. **Student Portal** (`/student/*`)
2. **College Admin Portal** (`/admin/*`)

Students report lost and found items, browse the campus catalog, receive Google Gemini AI match suggestions, submit claims with private ownership proofs, and track handovers. College Administrators moderate reports, verify ownership claims, manage physical handovers, assign administrator roles, monitor analytics, and export Excel reports.

---

## User Roles

### Student (`student`)
- Register and log in (automatically bound to the official configured college)
- Report lost items and found items with photos
- Search and filter published campus items
- View AI-assisted match suggestions
- Submit ownership claims with encrypted private proof uploads (`claim-proofs`)
- Track My Reports, My Claims, and real-time notifications
- Manage personal profile and view campus Lost & Found office info

### College Admin (`college_admin`)
- Dashboard overview (Total Students, Pending Lost/Found Reports, Active Claims, Successful Returns, Recent Activities)
- Moderate Lost Reports, Found Reports, and All Items (approve/publish, reject with reason, print QR storage tags)
- Review Claims, Verification dossiers (with signed URLs for private proofs), and Handover & Returns
- Confirm physical returns with automated Resend email notifications
- Manage campus Students directory and assign/revoke College Admin roles
- View campus Analytics, export multi-sheet `.xlsx` Excel reports, inspect Activity Logs, and configure official campus office details

---

## Database & Migration Setup

1. Run `/supabase/schema.sql` for a fresh database, or `/supabase/single_college_migration.sql` to migrate an existing multi-college Foundly database non-destructively (creates `backup_pre_single_college`, sets up `public.app_config`, backfills `college_id`, retires `foundly_owner` across RLS policies, and installs `assign_college_admin_role()`).
2. Run `/supabase/storage_migration.sql` to configure `item-images` and private `claim-proofs` bucket policies.
3. Configure `.env` based on `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, and optional `SINGLE_COLLEGE_ID`).
4. Bootstrap your initial College Admin using the SQL template at the bottom of `/supabase/single_college_migration.sql`.
