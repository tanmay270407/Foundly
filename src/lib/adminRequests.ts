import { supabase, SUPABASE_CONFIG } from './supabase';
import { AdminRequest } from '../types';

export interface AdminApplicationInput {
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  staffId: string;
  requestedCollegeName: string;
  proofFile?: File | null;
  statement: string;
}

export interface ParsedAdminRequest extends AdminRequest {
  extractedCollegeName: string;
  extractedStaffId: string;
  cleanStatement: string;
  assignedCollegeName?: string | null;
  assigned_college_id?: string | null;
}

/**
 * Extracts a tag from a formatted reason string
 * e.g. [Campus: Stanford University] or [Staff ID: EMP-1234]
 */
function extractTag(text: string | undefined | null, tagName: string): string | null {
  if (!text) return null;
  const regex = new RegExp(`\\[${tagName}:\\s*([^\\]]+)\\]`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Formats the application reason string preserving structured metadata
 */
export function formatAdminRequestReason(params: {
  requestedCollegeName: string;
  staffId: string;
  statement: string;
}): string {
  return [
    `[Campus: ${params.requestedCollegeName.trim()}]`,
    `[Staff ID: ${params.staffId.trim()}]`,
    '',
    'Role & Statement of Intent:',
    params.statement.trim()
  ].join('\n');
}

/**
 * Parses an admin request record into structured fields
 */
export function parseAdminRequest(req: any): ParsedAdminRequest {
  const reasonText = req?.reason || '';
  
  const extractedCollegeName = 
    req?.requested_college_name ||
    extractTag(reasonText, 'Campus') ||
    extractTag(reasonText, 'Requested Campus') ||
    req?.colleges?.name ||
    'Institution Not Specified';

  const extractedStaffId =
    req?.staff_id ||
    req?.representative_id ||
    extractTag(reasonText, 'Staff ID') ||
    extractTag(reasonText, 'Officer ID') ||
    'Not Provided';

  // Strip metadata tags from statement for clean presentation
  const cleanStatement = reasonText
    .replace(/\[Campus:\s*[^\]]+\]\n?/gi, '')
    .replace(/\[Requested Campus:\s*[^\]]+\]\n?/gi, '')
    .replace(/\[Staff ID:\s*[^\]]+\]\n?/gi, '')
    .replace(/\[Officer ID:\s*[^\]]+\]\n?/gi, '')
    .replace(/^Role & Statement of Intent:\s*\n?/im, '')
    .trim() || reasonText;

  return {
    ...req,
    requested_college_name: extractedCollegeName,
    staff_id: extractedStaffId,
    extractedCollegeName,
    extractedStaffId,
    cleanStatement,
    assignedCollegeName: req?.colleges?.name || null,
    assigned_college_id: req?.assigned_college_id || req?.college_id || null,
  };
}

/**
 * Uploads applicant verification proof document to private Supabase storage
 * Supported: PDF, PNG, JPG (max 10MB)
 */
export async function uploadProofDocument(file: File, userId?: string): Promise<string> {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Verification document exceeds maximum allowed size of 10MB.');
  }

  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Unsupported file format. Please upload a PDF, PNG, or JPG document.');
  }

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const userFolder = userId || 'applicant';
  const filePath = `admin_verifications/${userFolder}/${Date.now()}_${sanitizedFileName}`;

  // Try admin-proofs first, fallback to claim-proofs or adminVerification bucket
  const bucketsToTry = ['admin-proofs', 'claim-proofs', SUPABASE_CONFIG.storageBuckets.adminVerification];
  
  let lastError: any = null;
  for (const bucket of bucketsToTry) {
    if (!bucket) continue;
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!error && data) {
        return `${bucket}:${filePath}`;
      }
      lastError = error;
    } catch (err: any) {
      lastError = err;
    }
  }

  // If upload directly through storage fails (e.g. storage RLS or bucket uninitialized),
  // preserve the file reference metadata
  console.warn('[AdminApplication] Storage upload notice:', lastError);
  return `file_reference:${sanitizedFileName}`;
}

/**
 * Creates a signed URL for an authorized Owner to view private applicant verification documents
 */
export async function getProofDocumentSignedUrl(proofPath?: string): Promise<string | null> {
  if (!proofPath) return null;

  try {
    let bucket = 'admin-proofs';
    let path = proofPath;

    if (proofPath.includes(':')) {
      const parts = proofPath.split(':');
      if (parts[0] === 'file_reference') {
        return null; // Not stored in storage bucket
      }
      bucket = parts[0];
      path = parts.slice(1).join(':');
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1-hour secure signed URL

    if (error || !data?.signedUrl) {
      // Fallback check on claim-proofs
      if (bucket !== 'claim-proofs') {
        const fallback = await supabase.storage
          .from('claim-proofs')
          .createSignedUrl(path, 3600);
        if (fallback.data?.signedUrl) return fallback.data.signedUrl;
      }
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('[AdminApplication] Error generating signed URL:', err);
    return null;
  }
}
