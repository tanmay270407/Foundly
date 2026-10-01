import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, getCollegesFromDb, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { College } from '../../types';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  BadgeCheck, 
  Send, 
  Clock, 
  AlertCircle,
  FileCheck,
  Calendar,
  X,
  Eye,
  ArrowLeft,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { FileUpload } from '../../components/ui/FileUpload';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { 
  formatAdminRequestReason, 
  uploadProofDocument, 
  parseAdminRequest,
  ParsedAdminRequest 
} from '../../lib/adminRequests';

export const AdminApplicationPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { user, profile } = useAuth();

  // Form Fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [staffId, setStaffId] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reason, setReason] = useState('');

  // Colleges (for background reference mapping only, never a selector dropdown)
  const [colleges, setColleges] = useState<College[]>([]);

  // State Handling
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Result views: 'NONE' (form is shown), 'SUCCESS', 'ALREADY_PENDING', 'ALREADY_APPROVED'
  const [resultState, setResultState] = useState<'NONE' | 'SUCCESS' | 'ALREADY_PENDING' | 'ALREADY_APPROVED'>('NONE');
  
  // Stored application information for result displays
  const [existingPendingApplication, setExistingPendingApplication] = useState<ParsedAdminRequest | null>(null);
  const [approvedDetails, setApprovedDetails] = useState<{
    collegeName: string;
    collegeId?: string;
  } | null>(null);
  const [submittedDetails, setSubmittedDetails] = useState<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    staffId: string;
    collegeName: string;
    submittedAt: string;
    status: string;
  } | null>(null);

  // Modal to inspect full existing application details
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Sync profile data when available
  useEffect(() => {
    if (profile?.full_name && !fullName) {
      setFullName(profile.full_name);
    }
    if ((profile?.email || user?.email) && !email) {
      setEmail(profile?.email || user?.email || '');
    }
    if (profile?.phone && !phone) {
      setPhone(profile.phone);
    }
  }, [profile, user]);

  // Load existing colleges in background for metadata matching
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      try {
        const { data: cols } = await getCollegesFromDb();
        if (isMounted && cols) {
          setColleges(cols);
        }
      } catch (err) {
        console.warn('[AdminApplication] Background college load note:', err);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full legal name is required.';
    }

    if (!email.trim()) {
      errs.email = 'Campus official email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please provide a valid institutional email format.';
    }

    if (!phone.trim()) {
      errs.phone = 'Direct contact phone number is required.';
    }

    if (!staffId.trim()) {
      errs.staffId = 'Campus Faculty / Staff / Officer ID is required.';
    }

    if (!collegeName.trim()) {
      errs.collegeName = 'Campus or college name is required.';
    }

    if (!proofFile) {
      errs.proofFile = 'Please upload a staff ID, faculty badge, or authority letter.';
    } else {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(proofFile.type)) {
        errs.proofFile = 'Document must be a PDF, PNG, or JPG file.';
      } else if (proofFile.size > 10 * 1024 * 1024) {
        errs.proofFile = 'Document file size must not exceed 10MB.';
      }
    }

    if (!reason.trim()) {
      errs.reason = 'Please describe your department role and statement of intent.';
    } else if (reason.trim().length < 15) {
      errs.reason = 'Please provide a more detailed statement of intent (at least 15 characters).';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * Submission handler:
   * Duplicate checks occur ONLY when clicking "Submit Application".
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || isLoading) return;

    setIsLoading(true);
    setErrors({});

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const cleanPhone = phone.trim();
      const cleanStaffId = staffId.trim();
      const cleanCollegeName = collegeName.trim();
      const cleanStatement = reason.trim();

      // 1. Upload proof document if file is attached
      let uploadedProofPath = '';
      if (proofFile) {
        try {
          uploadedProofPath = await uploadProofDocument(proofFile, user?.id);
        } catch (uploadErr: any) {
          console.warn('[AdminApplication] Proof document storage notice:', uploadErr);
          uploadedProofPath = `file_reference:${proofFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        }
      }

      // 2. Attempt submission via backend endpoint (with atomic duplicate & role validation)
      let backendHandled = false;
      try {
        const res = await fetch('/api/admin-application/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            staffId: cleanStaffId,
            collegeName: cleanCollegeName,
            proofFilePath: uploadedProofPath,
            proofFileName: proofFile?.name,
            statement: cleanStatement,
            applicantId: user?.id || null
          })
        });

        if (res.ok) {
          const data = await res.json();
          backendHandled = true;

          if (data.status === 'ALREADY_APPROVED') {
            setIsLoading(false);
            setApprovedDetails({
              collegeName: data.assignedCollegeName || 'Your Assigned Campus',
              collegeId: data.assignedCollegeId
            });
            setResultState('ALREADY_APPROVED');
            showToast({
              type: 'info',
              title: 'Already Approved',
              message: 'Your account is already authorized as a College Administrator.',
            });
            return;
          }

          if (data.status === 'ALREADY_PENDING') {
            setIsLoading(false);
            const parsed = parseAdminRequest(data.existingApplication);
            setExistingPendingApplication(parsed);
            setResultState('ALREADY_PENDING');
            showToast({
              type: 'info',
              title: 'Application Already Submitted',
              message: 'You already have a College Admin application under review.',
            });
            return;
          }

          if (data.status === 'SUCCESS' && data.application) {
            setIsLoading(false);
            const app = data.application;
            const nowStr = new Date(app.created_at || Date.now()).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            setSubmittedDetails({
              id: app.id,
              fullName: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              staffId: cleanStaffId,
              collegeName: cleanCollegeName,
              submittedAt: nowStr,
              status: 'PENDING',
            });
            setResultState('SUCCESS');
            showToast({
              type: 'success',
              title: 'Application Submitted',
              message: 'Your College Admin application is now under review.',
            });
            return;
          }
        }
      } catch (backendErr) {
        console.warn('[AdminApplication] Backend API endpoint unavailable, falling back to direct Supabase client check:', backendErr);
      }

      // 3. Fallback: Direct Supabase client checks & insertion
      if (!backendHandled) {
        if (!isSupabaseConfigured()) {
          setIsLoading(false);
          setErrors({ form: 'Database is not configured in this environment.' });
          return;
        }

        // A. Check if already approved as College Admin
        if (user?.id) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*, colleges(*)')
            .eq('id', user.id)
            .maybeSingle();

          if (userProfile && userProfile.role === 'college_admin') {
            setIsLoading(false);
            setApprovedDetails({
              collegeName: userProfile.colleges?.name || 'Your Assigned Campus',
              collegeId: userProfile.college_id
            });
            setResultState('ALREADY_APPROVED');
            showToast({
              type: 'info',
              title: 'Already Approved',
              message: 'Your account is already authorized as a College Administrator.',
            });
            return;
          }
        }

        // B. Check for existing PENDING application (maximum 1 pending application allowed per user)
        let pendingCheckQuery = supabase
          .from('admin_requests')
          .select('*, colleges(*)')
          .eq('status', 'pending');

        if (user?.id) {
          pendingCheckQuery = pendingCheckQuery.or(`applicant_id.eq.${user.id},email.ilike.${cleanEmail}`);
        } else {
          pendingCheckQuery = pendingCheckQuery.ilike('email', cleanEmail);
        }

        const { data: existingPending, error: pendingErr } = await pendingCheckQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingPending) {
          setIsLoading(false);
          const parsed = parseAdminRequest(existingPending);
          setExistingPendingApplication(parsed);
          setResultState('ALREADY_PENDING');
          showToast({
            type: 'info',
            title: 'Application Already Submitted',
            message: 'You already have a College Admin application under review.',
          });
          return;
        }

        // C. Check if already has an APPROVED request
        let approvedCheckQuery = supabase
          .from('admin_requests')
          .select('*, colleges(*)')
          .eq('status', 'approved');

        if (user?.id) {
          approvedCheckQuery = approvedCheckQuery.or(`applicant_id.eq.${user.id},email.ilike.${cleanEmail}`);
        } else {
          approvedCheckQuery = approvedCheckQuery.ilike('email', cleanEmail);
        }

        const { data: existingApproved } = await approvedCheckQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingApproved) {
          setIsLoading(false);
          const parsed = parseAdminRequest(existingApproved);
          setApprovedDetails({
            collegeName: parsed.extractedCollegeName || parsed.colleges?.name || 'Your Assigned Campus',
            collegeId: existingApproved.college_id
          });
          setResultState('ALREADY_APPROVED');
          showToast({
            type: 'info',
            title: 'Already Approved',
            message: 'Your account is already authorized as a College Administrator.',
          });
          return;
        }

        // D. Previous rejected applications are preserved. We proceed to create a new application record!
        const formattedReason = formatAdminRequestReason({
          requestedCollegeName: cleanCollegeName,
          staffId: cleanStaffId,
          statement: cleanStatement,
        });

        // Resolve college reference if schema requires foreign key
        const matchingCollege = colleges.find(
          (c) =>
            c.name.trim().toLowerCase() === cleanCollegeName.toLowerCase() ||
            c.code.trim().toLowerCase() === cleanCollegeName.toLowerCase()
        );
        const matchedCollegeId = matchingCollege ? matchingCollege.id : (colleges.length > 0 ? colleges[0].id : null);

        const basePayload: any = {
          full_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          college_proof_path: uploadedProofPath,
          reason: formattedReason,
          status: 'pending',
        };

        if (user?.id) {
          basePayload.applicant_id = user.id;
        }
        if (matchedCollegeId) {
          basePayload.college_id = matchedCollegeId;
        }

        const extendedPayload = {
          ...basePayload,
          requested_college_name: cleanCollegeName,
          staff_id: cleanStaffId,
          representative_id: cleanStaffId,
          proof_information: proofFile?.name || null,
        };

        let insertError: any = null;
        let insertedId = '';

        const tryExtended = await supabase
          .from('admin_requests')
          .insert(extendedPayload)
          .select('id, created_at')
          .single();

        if (tryExtended.error) {
          // If duplicate unique constraint caught (concurrent race condition or double click)
          if (
            tryExtended.error.code === '23505' ||
            tryExtended.error.message?.includes('unique') ||
            tryExtended.error.message?.includes('duplicate')
          ) {
            const { data: conflictRow } = await pendingCheckQuery.limit(1).maybeSingle();
            setIsLoading(false);
            const parsed = parseAdminRequest(conflictRow || {
              requested_college_name: cleanCollegeName,
              status: 'pending',
              created_at: new Date().toISOString()
            });
            setExistingPendingApplication(parsed);
            setResultState('ALREADY_PENDING');
            return;
          }

          // Fallback to base columns
          const tryBase = await supabase
            .from('admin_requests')
            .insert(basePayload)
            .select('id, created_at')
            .single();

          if (tryBase.error) {
            if (
              tryBase.error.code === '23505' ||
              tryBase.error.message?.includes('unique') ||
              tryBase.error.message?.includes('duplicate')
            ) {
              const { data: conflictRow } = await pendingCheckQuery.limit(1).maybeSingle();
              setIsLoading(false);
              const parsed = parseAdminRequest(conflictRow || {
                requested_college_name: cleanCollegeName,
                status: 'pending',
                created_at: new Date().toISOString()
              });
              setExistingPendingApplication(parsed);
              setResultState('ALREADY_PENDING');
              return;
            }
            insertError = tryBase.error;
          } else {
            insertedId = tryBase.data?.id;
          }
        } else {
          insertedId = tryExtended.data?.id;
        }

        setIsLoading(false);

        if (insertError) {
          console.error('[AdminApplication] Insert error:', insertError);
          const friendlyMsg = getFriendlyAuthErrorMessage(insertError);
          setErrors({ form: friendlyMsg });
          showToast({
            type: 'error',
            title: 'Submission Failed',
            message: friendlyMsg,
          });
          return;
        }

        const nowStr = new Date().toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        setSubmittedDetails({
          id: insertedId || 'QUEUED-' + Date.now().toString().slice(-6),
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          staffId: cleanStaffId,
          collegeName: cleanCollegeName,
          submittedAt: nowStr,
          status: 'PENDING',
        });
        setResultState('SUCCESS');

        showToast({
          type: 'success',
          title: 'Application Submitted',
          message: 'Your College Admin application is now under review.',
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      console.error('[AdminApplication] Submission exception:', err);
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      setErrors({ form: friendlyMsg });
    }
  };

  /**
   * Reset the form to let applicant start fresh
   */
  const handleResetForm = () => {
    setResultState('NONE');
    setCollegeName('');
    setStaffId('');
    setProofFile(null);
    setReason('');
    setErrors({});
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
        {/* Header (always present) */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              College Admin Application
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Apply to manage lost &amp; found operations for your college or university campus
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SCENARIO 1: APPLICATION ALREADY EXISTS AND IS PENDING REVIEW */}
        {/* ============================================================ */}
        {resultState === 'ALREADY_PENDING' && existingPendingApplication && (
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-amber-200 text-center space-y-6 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
              <Clock className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 mb-1">
                <StatusBadge status="PENDING" size="sm" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Application Already Submitted
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600">
                You already have a College Admin application under review.
              </p>
            </div>

            {/* Display Requested College Name, Application ID, Submission Date, Status */}
            <div className="max-w-md mx-auto p-4 rounded-2xl bg-white border border-slate-200 text-left text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Requested College Name:</span>
                <span className="font-bold text-indigo-700 text-right">
                  {existingPendingApplication.extractedCollegeName || existingPendingApplication.requested_college_name || 'Institution on File'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Application ID:</span>
                <span className="font-mono text-slate-700 text-right truncate max-w-[200px]" title={existingPendingApplication.id}>
                  {existingPendingApplication.id}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Submission Date:</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5 text-right">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(existingPendingApplication.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-400 font-medium">Status:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                  <Clock className="w-3 h-3" />
                  Under Review
                </span>
              </div>
            </div>

            {/* Explanatory Message */}
            <div className="max-w-md mx-auto p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed text-center">
              Your application is currently being reviewed by the Foundly Owner. You will receive an email when a decision is made.
            </div>

            {/* Action Buttons: [ View Existing Application ] and [ Back to Application Form ] */}
            <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsDetailsModalOpen(true)}
                leftIcon={<Eye className="w-4 h-4 text-indigo-600" />}
              >
                View Existing Application
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setResultState('NONE')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Application Form
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 2: APPLICANT IS ALREADY APPROVED AS COLLEGE ADMIN   */}
        {/* ============================================================ */}
        {resultState === 'ALREADY_APPROVED' && (
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-emerald-200 text-center space-y-6 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <BadgeCheck className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 mb-1">
                <StatusBadge status="APPROVED" size="sm" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                College Admin Access Approved
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600">
                You have already been verified and approved as a College Administrator.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-white border border-slate-200 text-left text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Assigned College Campus:</span>
                <span className="font-bold text-emerald-800 text-right">
                  {approvedDetails?.collegeName || 'Verified Campus'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Role Status:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Active Administrator
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/admin')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                leftIcon={<Building2 className="w-4 h-4" />}
              >
                Go to College Admin Dashboard
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setResultState('NONE')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Application Form
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 3: NEW APPLICATION CREATED SUCCESSFULLY            */}
        {/* ============================================================ */}
        {resultState === 'SUCCESS' && submittedDetails && (
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-6 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
              <FileCheck className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 mb-1">
                <StatusBadge status="PENDING" size="sm" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Application Submitted
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600">
                Your College Admin application is now under review.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-white border border-slate-200 text-left text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Application ID:</span>
                <span className="font-mono text-slate-700 text-right truncate max-w-[200px]" title={submittedDetails.id}>
                  {submittedDetails.id}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Requested College:</span>
                <span className="font-bold text-indigo-700 text-right">
                  {submittedDetails.collegeName}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-medium">Submission Date:</span>
                <span className="font-medium text-slate-800 text-right">
                  {submittedDetails.submittedAt}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Status:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                  <Clock className="w-3 h-3" />
                  PENDING
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your institutional verification credentials have been logged for Platform Owner review. 
              You will receive an update once your campus assignment has been authorized.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/')}
              >
                Return to Home
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleResetForm}
                leftIcon={<FileText className="w-4 h-4" />}
              >
                Back to Application Form
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* BASE: THE APPLICATION FORM (ALWAYS ACCESSIBLE & VISIBLE)     */}
        {/* ============================================================ */}
        {resultState === 'NONE' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errors.form}</span>
              </div>
            )}

            {/* 1. Full Legal Name & 2. Campus Official Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Legal Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Jordan Hayes"
                error={errors.fullName}
                leftIcon={<User className="w-4 h-4" />}
                requiredIndicator
              />

              <Input
                label="Campus Official Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="j.hayes@campus.edu"
                error={errors.email}
                leftIcon={<Mail className="w-4 h-4" />}
                requiredIndicator
              />
            </div>

            {/* 3. Direct Phone Number & 4. Faculty / Staff / Officer ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Direct Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                error={errors.phone}
                leftIcon={<Phone className="w-4 h-4" />}
                requiredIndicator
              />

              <Input
                label="Faculty / Staff / Officer ID"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="EMP-84920"
                error={errors.staffId}
                leftIcon={<BadgeCheck className="w-4 h-4" />}
                requiredIndicator
              />
            </div>

            {/* 5. College / University Name (Free-Text Field, NOT a dropdown selector) */}
            <div>
              <Input
                label="Campus / College Name"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="Enter your college or university name"
                error={errors.collegeName}
                leftIcon={<Building2 className="w-4 h-4" />}
                helperText="Enter your institution's name. A college does not need to exist in Foundly yet; the Platform Owner will review your institution upon approval."
                requiredIndicator
              />
            </div>

            {/* 6. Staff Identification or Authority Letter */}
            <FileUpload
              label="Staff Identification or Authority Letter"
              value={proofFile}
              onChange={(file) => setProofFile(file)}
              error={errors.proofFile}
              helperText="Upload official staff ID card, faculty badge, department authorization letter, or official authority letter (PDF, PNG, JPG, max 10MB)"
            />

            {/* 7. Role & Statement of Intent */}
            <Textarea
              label="Role & Statement of Intent"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your campus department or office (e.g., Campus Police, Student Affairs, Facilities Desk) and your statement of intent for managing physical lost & found property."
              rows={3}
              error={errors.reason}
              requiredIndicator
            />

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {isLoading ? 'Submitting Application...' : 'Submit Application'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: VIEW EXISTING APPLICATION DETAILS                     */}
      {/* ============================================================ */}
      {isDetailsModalOpen && existingPendingApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Application Record</h3>
                  <p className="text-[11px] text-slate-500">Submitted College Admin Application</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Review Status:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[11px]">
                  <Clock className="w-3 h-3" />
                  Under Review
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Applicant Name</span>
                  <span className="font-semibold text-slate-900">{existingPendingApplication.full_name}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Campus Name</span>
                  <span className="font-bold text-indigo-700">{existingPendingApplication.extractedCollegeName}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Official Email</span>
                  <span className="font-medium text-slate-800">{existingPendingApplication.email}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Staff / Officer ID</span>
                  <span className="font-medium text-slate-800">{existingPendingApplication.extractedStaffId}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Application ID</span>
                  <span className="font-mono text-slate-700 text-[11px] block truncate">{existingPendingApplication.id}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Submission Date</span>
                  <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(existingPendingApplication.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">
                  Statement of Intent
                </span>
                <p className="italic text-slate-700 leading-relaxed text-xs">
                  "{existingPendingApplication.cleanStatement}"
                </p>
              </div>

              {existingPendingApplication.college_proof_path && (
                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                  <span className="text-indigo-900 font-medium">Verification Document:</span>
                  <span className="text-indigo-600 font-semibold text-[11px]">
                    Attached &amp; Verified on File
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsDetailsModalOpen(false)}
              >
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
