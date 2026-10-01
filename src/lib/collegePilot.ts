import { supabase, isSupabaseConfigured } from './supabase';

export type PilotState = 'NOT_STARTED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface PilotGoals {
  targetStudents: number;
  targetReports: number;
  targetReturns: number;
  endDate: string;
}

export interface AdminPilotChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface PilotMetrics {
  registeredStudents: number;
  activeStudents: number;
  lostReports: number;
  foundReports: number;
  claims: number;
  verifiedClaims: number;
  returnedItems: number;
  closedCases: number;
  pendingReports: number;
  pendingClaims: number;
}

export interface PilotFeedbackItem {
  id: string;
  collegeId: string;
  userId: string;
  role: string;
  userEmail?: string;
  rating?: number;
  feedback: string;
  createdAt: string;
}

export interface PilotIssueItem {
  id: string;
  collegeId: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CollegePilotData {
  collegeId: string;
  collegeName?: string;
  collegeCode?: string;
  pilotState: PilotState;
  startedAt?: string;
  startedBy?: string;
  completedAt?: string;
  completedBy?: string;
  goals: PilotGoals;
  adminChecklist: AdminPilotChecklistItem[];
  metrics: PilotMetrics;
  issues: PilotIssueItem[];
  feedbackCount: number;
}

export const DEFAULT_ADMIN_PILOT_CHECKLIST: AdminPilotChecklistItem[] = [
  { id: 'review_workflow', label: 'Admin knows review workflow', completed: false },
  { id: 'claim_verification_workflow', label: 'Admin knows claim verification workflow', completed: false },
  { id: 'handover_workflow', label: 'Admin knows handover workflow', completed: false },
  { id: 'return_closure_workflow', label: 'Admin knows return/closure workflow', completed: false },
  { id: 'storage_tag_workflow', label: 'Admin knows QR/storage-tag workflow', completed: false },
  { id: 'notification_workflow', label: 'Admin knows notification workflow', completed: false },
  { id: 'contact_owner_workflow', label: 'Admin knows how to contact Owner', completed: false },
];

/**
 * Fetches complete pilot details for a college.
 */
export async function getCollegePilotData(collegeId: string): Promise<CollegePilotData> {
  const defaultGoals: PilotGoals = {
    targetStudents: 100,
    targetReports: 25,
    targetReturns: 10,
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };

  const defaultMetrics: PilotMetrics = {
    registeredStudents: 0,
    activeStudents: 0,
    lostReports: 0,
    foundReports: 0,
    claims: 0,
    verifiedClaims: 0,
    returnedItems: 0,
    closedCases: 0,
    pendingReports: 0,
    pendingClaims: 0,
  };

  const defaultData: CollegePilotData = {
    collegeId,
    pilotState: 'NOT_STARTED',
    goals: defaultGoals,
    adminChecklist: DEFAULT_ADMIN_PILOT_CHECKLIST,
    metrics: defaultMetrics,
    issues: [],
    feedbackCount: 0,
  };

  if (!isSupabaseConfigured() || !collegeId) return defaultData;

  try {
    // 1. Fetch college info
    const { data: college } = await supabase.from('colleges').select('name, code').eq('id', collegeId).maybeSingle();
    if (college) {
      defaultData.collegeName = college.name;
      defaultData.collegeCode = college.code;
    }

    // 2. Fetch pilot log state
    const { data: pilotLogs } = await supabase
      .from('activity_logs')
      .select('details, created_at, actor_id')
      .eq('college_id', collegeId)
      .eq('action', 'COLLEGE_PILOT_UPDATE')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pilotLogs && pilotLogs.length > 0 && pilotLogs[0].details) {
      const details = pilotLogs[0].details as any;
      if (details.pilotState) defaultData.pilotState = details.pilotState;
      if (details.startedAt) defaultData.startedAt = details.startedAt;
      if (details.startedBy) defaultData.startedBy = details.startedBy;
      if (details.completedAt) defaultData.completedAt = details.completedAt;
      if (details.completedBy) defaultData.completedBy = details.completedBy;
      if (details.goals) defaultData.goals = { ...defaultGoals, ...details.goals };
      if (details.adminChecklist && Array.isArray(details.adminChecklist)) {
        const savedMap = new Map<string, boolean>(details.adminChecklist.map((c: any) => [c.id, Boolean(c.completed)]));
        defaultData.adminChecklist = DEFAULT_ADMIN_PILOT_CHECKLIST.map((item) => ({
          ...item,
          completed: Boolean(savedMap.get(item.id) ?? false),
        }));
      }
    }

    // 3. Compute live pilot metrics
    const { count: studentCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('role', 'student');

    const { count: lostCount } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('type', 'lost');

    const { count: foundCount } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('type', 'found');

    const { count: pendingRepCount } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('status', 'pending');

    const { count: totalClaims } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId);

    const { count: verifiedClaimsCount } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('status', 'approved');

    const { count: pendingClaimsCount } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('status', 'pending');

    const { count: returnedCount } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('status', 'returned');

    const { count: closedCount } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .in('status', ['returned', 'closed']);

    defaultData.metrics = {
      registeredStudents: studentCount || 0,
      activeStudents: studentCount || 0,
      lostReports: lostCount || 0,
      foundReports: foundCount || 0,
      claims: totalClaims || 0,
      verifiedClaims: verifiedClaimsCount || 0,
      returnedItems: returnedCount || 0,
      closedCases: closedCount || 0,
      pendingReports: pendingRepCount || 0,
      pendingClaims: pendingClaimsCount || 0,
    };

    // 4. Fetch pilot issues
    const { data: issueLogs } = await supabase
      .from('activity_logs')
      .select('id, details, created_at')
      .eq('college_id', collegeId)
      .eq('action', 'PILOT_ISSUE_UPDATE')
      .order('created_at', { ascending: false });

    if (issueLogs) {
      defaultData.issues = issueLogs.map((log) => ({
        id: log.id,
        collegeId,
        title: log.details?.title || 'Pilot Note',
        description: log.details?.description || '',
        severity: log.details?.severity || 'LOW',
        status: log.details?.status || 'OPEN',
        createdAt: log.created_at,
        resolvedAt: log.details?.resolvedAt,
        resolvedBy: log.details?.resolvedBy,
      }));
    }

    // 5. Fetch feedback count
    const { count: feedbackCount } = await supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', collegeId)
      .eq('action', 'PILOT_FEEDBACK_SUBMITTED');

    defaultData.feedbackCount = feedbackCount || 0;

    return defaultData;
  } catch (err) {
    console.error('Error in getCollegePilotData:', err);
    return defaultData;
  }
}

/**
 * Updates pilot status, goals, and admin pilot checklist in Supabase
 */
export async function saveCollegePilotData(
  collegeId: string,
  userId: string,
  pilotState: PilotState,
  goals?: PilotGoals,
  adminChecklist?: AdminPilotChecklistItem[],
  actorEmail?: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !collegeId) return false;

  try {
    const existing = await getCollegePilotData(collegeId);
    const startedAt = pilotState === 'ACTIVE' && !existing.startedAt ? new Date().toISOString() : existing.startedAt;
    const startedBy = pilotState === 'ACTIVE' && !existing.startedBy ? actorEmail || userId : existing.startedBy;
    const completedAt = pilotState === 'COMPLETED' ? new Date().toISOString() : existing.completedAt;
    const completedBy = pilotState === 'COMPLETED' ? actorEmail || userId : existing.completedBy;

    const { error } = await supabase.from('activity_logs').insert({
      college_id: collegeId,
      actor_id: userId,
      user_id: userId,
      action: 'COLLEGE_PILOT_UPDATE',
      entity_type: 'COLLEGE',
      entity_id: collegeId,
      details: {
        pilotState,
        startedAt,
        startedBy,
        completedAt,
        completedBy,
        goals: goals || existing.goals,
        adminChecklist: adminChecklist || existing.adminChecklist,
        updatedAt: new Date().toISOString(),
      },
    });

    if (error) {
      console.error('Error saving pilot data:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception saving pilot data:', err);
    return false;
  }
}

/**
 * Submits student or College Admin pilot feedback to Supabase
 */
export async function submitPilotFeedback(
  collegeId: string,
  userId: string,
  role: string,
  feedback: string,
  rating?: number,
  userEmail?: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !collegeId) return false;

  try {
    const { error } = await supabase.from('activity_logs').insert({
      college_id: collegeId,
      actor_id: userId,
      user_id: userId,
      action: 'PILOT_FEEDBACK_SUBMITTED',
      entity_type: 'COLLEGE',
      entity_id: collegeId,
      details: {
        collegeId,
        userId,
        role,
        rating: rating || 5,
        feedback,
        userEmail: userEmail || 'student@college.edu',
        createdAt: new Date().toISOString(),
      },
    });

    return !error;
  } catch (err) {
    console.error('Exception submitting feedback:', err);
    return false;
  }
}

/**
 * Loads all submitted feedback for a college (Owner access)
 */
export async function getPilotFeedbackList(collegeId: string): Promise<PilotFeedbackItem[]> {
  if (!isSupabaseConfigured() || !collegeId) return [];

  try {
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('id, details, created_at, actor_id')
      .eq('college_id', collegeId)
      .eq('action', 'PILOT_FEEDBACK_SUBMITTED')
      .order('created_at', { ascending: false });

    if (!logs) return [];

    return logs.map((log) => ({
      id: log.id,
      collegeId,
      userId: log.actor_id || log.details?.userId || '',
      role: log.details?.role || 'student',
      userEmail: log.details?.userEmail || 'Anonymous',
      rating: log.details?.rating || 5,
      feedback: log.details?.feedback || '',
      createdAt: log.created_at,
    }));
  } catch (err) {
    console.error('Exception getting feedback list:', err);
    return [];
  }
}

/**
 * Creates or updates an issue item for a pilot college (Owner access)
 */
export async function recordPilotIssue(
  collegeId: string,
  userId: string,
  title: string,
  description: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
  actorName?: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !collegeId) return false;

  try {
    const { error } = await supabase.from('activity_logs').insert({
      college_id: collegeId,
      actor_id: userId,
      user_id: userId,
      action: 'PILOT_ISSUE_UPDATE',
      entity_type: 'COLLEGE',
      entity_id: collegeId,
      details: {
        title,
        description,
        severity,
        status,
        createdAt: new Date().toISOString(),
        resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : undefined,
        resolvedBy: status === 'RESOLVED' ? actorName || userId : undefined,
      },
    });

    return !error;
  } catch (err) {
    console.error('Exception recording pilot issue:', err);
    return false;
  }
}
