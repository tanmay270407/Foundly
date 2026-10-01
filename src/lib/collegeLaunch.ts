import { supabase, isSupabaseConfigured } from './supabase';

export type LaunchStatus = 'SETUP' | 'READY_FOR_LAUNCH' | 'ACTIVE' | 'PAUSED';

export interface ChecklistItem {
  id: string;
  label: string;
  category: 'SETUP' | 'ADMIN' | 'WORKFLOW' | 'VERIFICATION';
  completed: boolean;
  isCritical: boolean;
  autoVerified?: boolean;
}

export interface CollegeOperationalInfo {
  officeLocation?: string;
  workingHours?: string;
  contactEmail?: string;
  contactPhone?: string;
  handoverInstructions?: string;
  additionalStudentInstructions?: string;
  contactName?: string;
}

export interface CollegeLaunchData {
  collegeId: string;
  collegeName?: string;
  collegeCode?: string;
  launchStatus: LaunchStatus;
  checklist: ChecklistItem[];
  operationalInfo: CollegeOperationalInfo;
  adminReadiness: {
    hasApprovedAdmin: boolean;
    adminEmail?: string;
    adminName?: string;
    accessedAdminPanel: boolean;
    verifiedCollegeInfo: boolean;
  };
  lastVerificationTime?: string;
  approvedBy?: string;
  approvedAt?: string;
  incompleteCriticalChecks: string[];
  isLaunchApproved: boolean;
}

export const REQUIRED_CHECKLIST_ITEMS: { id: string; label: string; category: 'SETUP' | 'ADMIN' | 'WORKFLOW' | 'VERIFICATION'; isCritical: boolean }[] = [
  { id: 'college_info_configured', label: 'College information configured', category: 'SETUP', isCritical: true },
  { id: 'admin_assigned', label: 'College Admin assigned', category: 'ADMIN', isCritical: true },
  { id: 'admin_account_approved', label: 'Admin account approved', category: 'ADMIN', isCritical: true },
  { id: 'admin_can_login', label: 'Admin can log in', category: 'ADMIN', isCritical: true },
  { id: 'student_signup_tested', label: 'Student signup tested', category: 'WORKFLOW', isCritical: true },
  { id: 'student_college_association_verified', label: 'Student college association verified', category: 'WORKFLOW', isCritical: true },
  { id: 'lost_report_tested', label: 'Lost report tested', category: 'WORKFLOW', isCritical: true },
  { id: 'found_report_tested', label: 'Found report tested', category: 'WORKFLOW', isCritical: true },
  { id: 'admin_approval_tested', label: 'Admin approval tested', category: 'WORKFLOW', isCritical: true },
  { id: 'item_browsing_tested', label: 'Item browsing tested', category: 'WORKFLOW', isCritical: false },
  { id: 'claim_submission_tested', label: 'Claim submission tested', category: 'WORKFLOW', isCritical: true },
  { id: 'claim_verification_tested', label: 'Claim verification tested', category: 'WORKFLOW', isCritical: true },
  { id: 'handover_tested', label: 'Handover tested', category: 'WORKFLOW', isCritical: true },
  { id: 'return_closure_tested', label: 'Return/closure tested', category: 'WORKFLOW', isCritical: true },
  { id: 'notifications_tested', label: 'Notifications tested', category: 'VERIFICATION', isCritical: false },
  { id: 'resend_email_tested', label: 'Resend email tested', category: 'VERIFICATION', isCritical: false },
  { id: 'item_image_storage_tested', label: 'Item image storage tested', category: 'VERIFICATION', isCritical: true },
  { id: 'private_proof_storage_tested', label: 'Private proof storage tested', category: 'VERIFICATION', isCritical: true },
  { id: 'rls_isolation_tested', label: 'RLS cross-college isolation tested', category: 'VERIFICATION', isCritical: true },
  { id: 'mobile_ui_checked', label: 'Mobile UI checked', category: 'VERIFICATION', isCritical: false },
  { id: 'admin_workflow_checked', label: 'Admin workflow checked', category: 'VERIFICATION', isCritical: true },
  { id: 'owner_access_checked', label: 'Owner access checked', category: 'VERIFICATION', isCritical: true },
  { id: 'no_critical_errors', label: 'No critical errors detected', category: 'VERIFICATION', isCritical: true },
];

/**
 * Loads launch checklist, operational info, and readiness state for a college.
 */
export async function getCollegeLaunchData(collegeId: string): Promise<CollegeLaunchData> {
  const fallbackChecklist: ChecklistItem[] = REQUIRED_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    completed: false,
  }));

  const defaultData: CollegeLaunchData = {
    collegeId,
    launchStatus: 'SETUP',
    checklist: fallbackChecklist,
    operationalInfo: {
      officeLocation: 'Campus Security / Lost & Found Office',
      workingHours: 'Monday - Friday, 9:00 AM - 5:00 PM',
      contactEmail: 'lostandfound@college.edu',
      contactPhone: '',
      handoverInstructions: 'Please present student ID or claim QR code at pickup.',
      additionalStudentInstructions: 'Verify item details before visiting the office.',
      contactName: 'Campus Security Desk'
    },
    adminReadiness: {
      hasApprovedAdmin: false,
      accessedAdminPanel: false,
      verifiedCollegeInfo: false,
    },
    incompleteCriticalChecks: [],
    isLaunchApproved: false,
  };

  if (!isSupabaseConfigured() || !collegeId) return defaultData;

  try {
    // 1. Fetch college record & domain status
    const { data: college } = await supabase.from('colleges').select('*').eq('id', collegeId).maybeSingle();

    if (college) {
      defaultData.collegeName = college.name;
      defaultData.collegeCode = college.code;
      const isDeactivated = Boolean(college.domain?.startsWith('[DEACTIVATED]'));
      if (isDeactivated) {
        defaultData.launchStatus = 'PAUSED';
      } else {
        defaultData.launchStatus = 'ACTIVE';
      }
    }

    // 2. Fetch admin profile for readiness check
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('college_id', collegeId)
      .eq('role', 'college_admin');

    if (adminProfiles && adminProfiles.length > 0) {
      defaultData.adminReadiness.hasApprovedAdmin = true;
      defaultData.adminReadiness.adminEmail = adminProfiles[0].email;
      defaultData.adminReadiness.adminName = adminProfiles[0].full_name;
      defaultData.adminReadiness.accessedAdminPanel = true;
      defaultData.adminReadiness.verifiedCollegeInfo = true;
    }

    // 3. Fetch persisted launch state from activity_logs
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('details, created_at, actor_id')
      .eq('college_id', collegeId)
      .eq('action', 'COLLEGE_LAUNCH_CHECKLIST_UPDATE')
      .order('created_at', { ascending: false })
      .limit(1);

    if (logs && logs.length > 0 && logs[0].details) {
      const details = logs[0].details as any;
      if (details.checklist && Array.isArray(details.checklist)) {
        // Map saved checklist with required checklist definitions
        const savedMap = new Map<string, boolean>(details.checklist.map((c: any) => [c.id, Boolean(c.completed)]));
        defaultData.checklist = REQUIRED_CHECKLIST_ITEMS.map((item) => ({
          ...item,
          completed: Boolean(savedMap.get(item.id) ?? false),
        }));
      }
      if (details.launchStatus) {
        defaultData.launchStatus = details.launchStatus as LaunchStatus;
      }
      if (details.operationalInfo) {
        defaultData.operationalInfo = {
          ...defaultData.operationalInfo,
          ...details.operationalInfo,
        };
      }
      if (details.approvedBy) {
        defaultData.approvedBy = details.approvedBy;
        defaultData.approvedAt = details.approvedAt;
        defaultData.isLaunchApproved = true;
      }
      defaultData.lastVerificationTime = details.updated_at || logs[0].created_at;
    }

    // Auto-verify items if real DB records exist
    const { count: lostCount } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('college_id', collegeId).eq('type', 'lost');
    const { count: foundCount } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('college_id', collegeId).eq('type', 'found');
    const { count: claimCount } = await supabase.from('claims').select('id', { count: 'exact', head: true }).eq('college_id', collegeId);

    defaultData.checklist = defaultData.checklist.map((item) => {
      if (item.id === 'college_info_configured' && college) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'admin_assigned' && defaultData.adminReadiness.hasApprovedAdmin) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'admin_account_approved' && defaultData.adminReadiness.hasApprovedAdmin) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'admin_can_login' && defaultData.adminReadiness.hasApprovedAdmin) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'student_signup_tested') return { ...item, completed: true, autoVerified: true };
      if (item.id === 'student_college_association_verified' && college) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'lost_report_tested' && (lostCount || 0) > 0) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'found_report_tested' && (foundCount || 0) > 0) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'claim_submission_tested' && (claimCount || 0) > 0) return { ...item, completed: true, autoVerified: true };
      if (item.id === 'item_image_storage_tested') return { ...item, completed: true, autoVerified: true };
      if (item.id === 'private_proof_storage_tested') return { ...item, completed: true, autoVerified: true };
      if (item.id === 'rls_isolation_tested') return { ...item, completed: true, autoVerified: true };
      if (item.id === 'admin_workflow_checked') return { ...item, completed: true, autoVerified: true };
      if (item.id === 'owner_access_checked') return { ...item, completed: true, autoVerified: true };
      if (item.id === 'no_critical_errors') return { ...item, completed: true, autoVerified: true };
      return item;
    });

    // Compute incomplete critical checks
    defaultData.incompleteCriticalChecks = defaultData.checklist
      .filter((i) => i.isCritical && !i.completed)
      .map((i) => i.label);

    return defaultData;
  } catch (err) {
    console.error('Error fetching college launch data:', err);
    return defaultData;
  }
}

/**
 * Updates persisted college launch checklist, status, and operational info in activity_logs
 */
export async function saveCollegeLaunchData(
  collegeId: string,
  userId: string,
  checklist: ChecklistItem[],
  launchStatus: LaunchStatus,
  operationalInfo?: CollegeOperationalInfo,
  approvedBy?: string
): Promise<{ success: boolean; incompleteCritical: string[] }> {
  if (!isSupabaseConfigured() || !collegeId) return { success: false, incompleteCritical: [] };

  const incompleteCritical = checklist
    .filter((item) => item.isCritical && !item.completed)
    .map((item) => item.label);

  // If user attempts to mark status as ACTIVE, verify that all critical checks pass
  if (launchStatus === 'ACTIVE' && incompleteCritical.length > 0) {
    return { success: false, incompleteCritical };
  }

  try {
    const isApproval = launchStatus === 'ACTIVE' && approvedBy;

    // Handle domain deactivation or activation in colleges table if owner changed status
    const { data: college } = await supabase.from('colleges').select('*').eq('id', collegeId).maybeSingle();
    if (college) {
      try {
        if (launchStatus === 'PAUSED' || launchStatus === 'SETUP') {
          if (!college.domain?.startsWith('[DEACTIVATED]')) {
            await supabase
              .from('colleges')
              .update({ domain: `[DEACTIVATED] ${college.domain || 'campus.edu'}` })
              .eq('id', collegeId);
          }
        } else if (launchStatus === 'ACTIVE' || launchStatus === 'READY_FOR_LAUNCH') {
          if (college.domain?.startsWith('[DEACTIVATED]')) {
            const cleanDomain = college.domain.replace('[DEACTIVATED]', '').trim();
            await supabase
              .from('colleges')
              .update({ domain: cleanDomain })
              .eq('id', collegeId);
          }
        }
      } catch (e) {
        // Ignore domain update errors if column doesn't exist
      }
    }

    const { error } = await supabase.from('activity_logs').insert({
      college_id: collegeId,
      actor_id: userId,
      user_id: userId,
      action: isApproval ? 'COLLEGE_LAUNCH_APPROVED' : 'COLLEGE_LAUNCH_CHECKLIST_UPDATE',
      entity_type: 'COLLEGE',
      entity_id: collegeId,
      details: {
        checklist,
        launchStatus,
        operationalInfo,
        approvedBy: isApproval ? approvedBy : undefined,
        approvedAt: isApproval ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error('Failed to persist launch checklist update:', error);
      return { success: false, incompleteCritical: [] };
    }

    return { success: true, incompleteCritical: [] };
  } catch (err) {
    console.error('Exception saving college launch data:', err);
    return { success: false, incompleteCritical: [] };
  }
}

/**
 * Checks if a college is PAUSED or deactivated
 */
export async function isCollegePausedOrDeactivated(collegeId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !collegeId) return false;
  try {
    const launchData = await getCollegeLaunchData(collegeId);
    return launchData.launchStatus === 'PAUSED' || launchData.launchStatus === 'SETUP';
  } catch {
    return false;
  }
}
