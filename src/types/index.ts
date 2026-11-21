/**
 * Foundly Types & Interfaces
 * Single-College Lost & Found Management System (Student & College Admin Portals)
 */

export type UserRole =
  | 'student'
  | 'college_admin'
  | 'STUDENT'
  | 'COLLEGE_ADMIN';

export type NormalizedRole = 'student' | 'college_admin' | 'retired_owner';

export function normalizeRole(role?: string | null): NormalizedRole {
  const r = role?.toLowerCase();
  if (r === 'college_admin') return 'college_admin';
  if (r === 'foundly_owner') return 'retired_owner';
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
  'OTHER',
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

export type ContactPreference = 'EMAIL' | 'PHONE' | 'CAMPUS_OFFICE' | 'IN_APP';

// ==========================================
// Database Schema Interfaces
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

export interface ConfiguredCollege {
  id: string;
  name: string;
  code: string;
  city?: string | null;
  state?: string | null;
  office_name: string;
  office_location: string;
  office_hours: string;
  contact_email: string;
  contact_phone: string;
  pickup_instructions: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  college_id: string;
  role: UserRole | 'foundly_owner';
  phone?: string;
  avatar_url?: string;
  colleges?: College;
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
  current_storage_location?: string;
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
  lost_item_id?: string | null;
  match_id?: string | null;
  linked_lost_item?: Item | null;
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
  actor_id?: string;
  action: string;
  entity_type: 'ITEM' | 'CLAIM' | 'PROFILE' | 'COLLEGE' | 'ITEM_MATCH';
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

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
  similarity_score?: number;
  match_reasons: string[];
  ai_summary: string;
  status: 'SUGGESTED' | 'DISMISSED' | 'CLAIMED' | 'VERIFIED' | 'NOT_A_MATCH';
  created_at: string;
  updated_at?: string;
  lost_item?: Item;
  found_item?: Item;
  user_role_in_match?: 'LOST_OWNER' | 'FINDER' | 'BOTH';
  existing_claim_id?: string | null;
  existing_claim_status?: string | null;
  can_claim_from_lost_report?: boolean;
}
