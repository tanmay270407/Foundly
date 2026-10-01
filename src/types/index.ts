/**
 * Foundly Types & Interfaces
 * Phase 1 — Foundation & Multi-College Architecture
 */

export type UserRole = 
  | 'student' 
  | 'college_admin' 
  | 'foundly_owner'
  | 'STUDENT' 
  | 'COLLEGE_ADMIN' 
  | 'FOUNDLY_OWNER';

export function normalizeRole(role?: string | null): 'student' | 'college_admin' | 'foundly_owner' {
  const r = role?.toLowerCase();
  if (r === 'college_admin') return 'college_admin';
  if (r === 'foundly_owner') return 'foundly_owner';
  return 'student';
}

export type ItemType = 'LOST' | 'FOUND';

export type ItemCategory = 
  | 'ELECTRONICS'
  | 'ID_AND_CARDS'
  | 'KEYS'
  | 'BAGS_AND_BACKPACKS'
  | 'CLOTHING_AND_ACCESSORIES'
  | 'BOOKS_AND_STATIONERY'
  | 'BOTTLES_AND_MUGS'
  | 'JEWELRY_AND_WATCHES'
  | 'OTHER';

export const CATEGORIES: ItemCategory[] = [
  'ELECTRONICS',
  'ID_AND_CARDS',
  'KEYS',
  'BAGS_AND_BACKPACKS',
  'CLOTHING_AND_ACCESSORIES',
  'BOOKS_AND_STATIONERY',
  'BOTTLES_AND_MUGS',
  'JEWELRY_AND_WATCHES',
  'OTHER'
];

export type ItemStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'CLAIMED'
  | 'UNDER_VERIFICATION'
  | 'HANDOVER'
  | 'RETURNED'
  | 'CLOSED'
  | 'UNDER_REVIEW'
  | 'COMPLETED';

export type ClaimStatus = 
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'HANDOVER'
  | 'COMPLETED';

export type AdminRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ContactPreference = 'EMAIL' | 'PHONE' | 'CAMPUS_OFFICE' | 'IN_APP';

// ==========================================
// Database Schema Interfaces (Supabase Ready)
// ==========================================

export interface College {
  id: string;
  name: string;
  code: string;
  domain?: string;
  city?: string;
  state?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  college_id: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface Item {
  id: string;
  user_id: string;
  college_id: string;
  type: ItemType;
  item_name: string;
  category: ItemCategory;
  description: string;
  image_path?: string;
  date: string;
  approximate_time?: string;
  location: string;
  brand?: string;
  color?: string;
  unique_marks?: string; // Private verification info for FOUND items
  storage_location?: string; // Where item is stored if found
  contact_preference: ContactPreference;
  status: ItemStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  returned_at?: string;
  returned_by?: string;
  created_at: string;
}

export interface Claim {
  id: string;
  item_id: string;
  claimant_id: string;
  college_id: string;
  claim_explanation: string;
  lost_date?: string;
  lost_location?: string;
  identifying_details?: string;
  ownership_proof_path?: string;
  contact_information?: string;
  additional_message?: string;
  status: ClaimStatus;
  next_step?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  handover_at?: string;
  completed_at?: string;
  completed_by?: string;
  handover_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface AdminRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  college_id: string;
  representative_id: string;
  proof_file_path?: string;
  reason: string;
  status: AdminRequestStatus;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  college_id?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  college_id: string;
  user_id: string;
  action: string;
  entity_type: 'ITEM' | 'CLAIM' | 'ADMIN_REQUEST' | 'COLLEGE';
  entity_id: string;
  details?: Record<string, unknown>;
  created_at: string;
}

// ==========================================
// Form Payloads
// ==========================================

export interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  collegeId: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface AdminApplicationFormData {
  fullName: string;
  email: string;
  phone: string;
  collegeId: string;
  representativeId: string;
  proofFile: File | null;
  reason: string;
}

export interface ReportLostFormData {
  itemName: string;
  category: ItemCategory;
  dateLost: string;
  approximateTime: string;
  location: string;
  description: string;
  brand: string;
  color: string;
  uniqueMarks: string;
  image: File | null;
  contactPreference: ContactPreference;
}

export interface ReportFoundFormData {
  itemName: string;
  category: ItemCategory;
  dateFound: string;
  approximateTime: string;
  location: string;
  description: string;
  brand: string;
  color: string;
  uniqueDetails: string;
  image: File | null;
  currentLocation: string;
  contactPreference: ContactPreference;
}

export interface ItemMatch {
  id: string;
  lost_item_id: string;
  found_item_id: string;
  college_id: string;
  match_score: number;
  match_reasons: string[];
  ai_summary: string;
  status: 'SUGGESTED' | 'DISMISSED' | 'CLAIMED' | 'VERIFIED' | 'NOT_A_MATCH';
  created_at: string;
  updated_at?: string;
  lost_item?: Item;
  found_item?: Item;
}

