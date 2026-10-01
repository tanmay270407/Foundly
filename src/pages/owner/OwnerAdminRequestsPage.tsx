import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Building2, 
  Mail, 
  Phone, 
  Calendar, 
  AlertTriangle,
  BadgeCheck,
  FileText,
  ExternalLink,
  PlusCircle,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Info,
  ChevronRight,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Copy
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, getCollegesFromDb } from '../../lib/supabase';
import { College } from '../../types';
import { 
  parseAdminRequest, 
  getProofDocumentSignedUrl,
  ParsedAdminRequest 
} from '../../lib/adminRequests';

type StatusFilterTab = 'all' | 'pending' | 'approved' | 'rejected';

export const OwnerAdminRequestsPage: React.FC = () => {
  const { showToast } = useToast();
  const { session } = useAuth();
  
  const [requests, setRequests] = useState<ParsedAdminRequest[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCreatingCollege, setIsCreatingCollege] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<StatusFilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Detailed Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeReviewRequest, setActiveReviewRequest] = useState<ParsedAdminRequest | null>(null);

  // College Assignment Mode within Review
  const [collegeAssignMode, setCollegeAssignMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingCollegeId, setSelectedExistingCollegeId] = useState('');
  const [collegeSearchQuery, setCollegeSearchQuery] = useState('');

  // New College Creation Fields within Review Modal
  const [newCollegeName, setNewCollegeName] = useState('');
  const [newCollegeCode, setNewCollegeCode] = useState('');
  const [newCollegeCity, setNewCollegeCity] = useState('');
  const [newCollegeState, setNewCollegeState] = useState('');
  const [newCollegeDomain, setNewCollegeDomain] = useState('');

  // Decision States
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Proof Document Preview State
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDocName, setPreviewDocName] = useState('');
  const [isLoadingProofUrl, setIsLoadingProofUrl] = useState(false);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: `${label} copied to clipboard.`,
    });
  };

  const loadData = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);

      // 1. Load active colleges for assignment
      const { data: cols } = await getCollegesFromDb();
      setColleges(cols || []);

      // 2. Load all admin applications (pending, approved, rejected)
      // Try Owner API first for backend-verified fetch, fallback to client Supabase
      const token = session?.access_token;
      let rawRequests: any[] = [];

      try {
        const apiRes = await fetch('/api/owner/admin-requests', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          rawRequests = apiData.requests || [];
        } else {
          throw new Error('API fallback');
        }
      } catch {
        // Fallback to direct Supabase client
        const { data, error } = await supabase
          .from('admin_requests')
          .select('*, colleges(*)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        rawRequests = data || [];
      }

      const parsed = rawRequests.map(parseAdminRequest);
      setRequests(parsed);
    } catch (err: any) {
      console.error('Error loading admin requests:', err);
      showToast({
        type: 'error',
        title: 'Query Failed',
        message: 'Could not load college administrator applications.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered requests computation
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status filter
      if (activeTab !== 'all') {
        const reqStatus = (req.status || 'pending').toLowerCase();
        if (reqStatus !== activeTab) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (req.full_name || '').toLowerCase().includes(q);
        const matchesEmail = (req.email || '').toLowerCase().includes(q);
        const matchesCampus = (req.extractedCollegeName || '').toLowerCase().includes(q);
        const matchesStaffId = (req.extractedStaffId || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesCampus || matchesStaffId;
      }

      return true;
    });
  }, [requests, activeTab, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => (r.status || 'pending').toLowerCase() === 'pending').length,
      approved: requests.filter((r) => (r.status || '').toLowerCase() === 'approved').length,
      rejected: requests.filter((r) => (r.status || '').toLowerCase() === 'rejected').length,
    };
  }, [requests]);

  // Open Detailed Review Modal
  const openReviewModal = (req: ParsedAdminRequest) => {
    setActiveReviewRequest(req);
    setShowRejectForm(false);
    setRejectionReason('');

    // Pre-calculate suggested code from requested campus name
    const requestedName = req.extractedCollegeName !== 'Institution Not Specified' 
      ? req.extractedCollegeName 
      : '';
    
    // Look for matching college among existing active colleges
    const matchingCol = colleges.find(
      (c) =>
        c.name.toLowerCase() === requestedName.toLowerCase() ||
        c.code.toLowerCase() === requestedName.toLowerCase()
    );

    if (matchingCol) {
      setCollegeAssignMode('existing');
      setSelectedExistingCollegeId(matchingCol.id);
    } else if (req.college_id && colleges.some(c => c.id === req.college_id)) {
      setCollegeAssignMode('existing');
      setSelectedExistingCollegeId(req.college_id);
    } else if (colleges.length > 0) {
      setCollegeAssignMode('existing');
      setSelectedExistingCollegeId(colleges[0].id);
    } else {
      setCollegeAssignMode('new');
      setSelectedExistingCollegeId('');
    }

    // Prefill new college inputs with applicant requested name
    setNewCollegeName(requestedName);
    
    const words = requestedName
      .replace(/university|college|institute|of|the|at|campus/gi, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const suggestedCode = words.length >= 2 
      ? words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
      : requestedName.slice(0, 4).toUpperCase();
    setNewCollegeCode(suggestedCode || 'CAMP');

    // Extract potential domain if applicant email is institutional
    const emailDomain = req.email.includes('@') ? req.email.split('@')[1] : '';
    const isEducationalDomain = emailDomain.endsWith('.edu') || emailDomain.includes('.ac.');
    setNewCollegeDomain(isEducationalDomain ? emailDomain : '');
    setNewCollegeCity('');
    setNewCollegeState('');

    setIsReviewModalOpen(true);
  };

  // Filtered colleges for assignment search
  const filteredColleges = useMemo(() => {
    if (!collegeSearchQuery.trim()) return colleges;
    const q = collegeSearchQuery.toLowerCase();
    return colleges.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q)
    );
  }, [colleges, collegeSearchQuery]);

  // Handle Create New College from Review Modal
  const handleCreateCollegeFromReview = async () => {
    if (!newCollegeName.trim() || !newCollegeCode.trim()) {
      showToast({
        type: 'error',
        title: 'Missing Required Fields',
        message: 'Please provide both college full name and a short campus code.',
      });
      return;
    }

    try {
      setIsCreatingCollege(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/create-college', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCollegeName.trim(),
          code: newCollegeCode.trim().toUpperCase(),
          city: newCollegeCity.trim() || undefined,
          state: newCollegeState.trim() || undefined,
          domain: newCollegeDomain.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create new college directory.');
      }

      const createdCol = data.college;
      showToast({
        type: 'success',
        title: 'College Directory Created 🎉',
        message: `Registered ${createdCol.name} (${createdCol.code}). It is now assigned to this application.`,
      });

      // Update colleges in local state
      setColleges((prev) => [...prev, createdCol]);
      // Set as currently assigned college and switch to existing mode
      setSelectedExistingCollegeId(createdCol.id);
      setCollegeAssignMode('existing');
    } catch (err: any) {
      console.error('Error creating college in review:', err);
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Could not register new college.',
      });
    } finally {
      setIsCreatingCollege(false);
    }
  };

  // Handle Approve Action
  const handleApproveAction = async () => {
    if (!activeReviewRequest || isActionLoading) return;

    try {
      setIsActionLoading(true);
      const token = session?.access_token;
      let targetCollegeId = selectedExistingCollegeId;

      // If Owner is in new college creation mode and has filled out fields
      if (collegeAssignMode === 'new') {
        if (!newCollegeName.trim() || !newCollegeCode.trim()) {
          showToast({
            type: 'error',
            title: 'College Details Required',
            message: 'Please provide a name and short code for the new campus, or select an existing college.',
          });
          setIsActionLoading(false);
          return;
        }

        // Create the new college first
        const createColRes = await fetch('/api/owner/create-college', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: newCollegeName.trim(),
            code: newCollegeCode.trim().toUpperCase(),
            city: newCollegeCity.trim() || undefined,
            state: newCollegeState.trim() || undefined,
            domain: newCollegeDomain.trim() || undefined
          })
        });

        const colData = await createColRes.json();
        if (!createColRes.ok) {
          throw new Error(colData.error || 'Failed to register new campus directory.');
        }

        targetCollegeId = colData.college.id;
        setColleges((prev) => [...prev, colData.college]);
      }

      if (!targetCollegeId) {
        showToast({
          type: 'error',
          title: 'Assignment Required',
          message: 'Please select or create an institutional directory to assign this administrator to.',
        });
        setIsActionLoading(false);
        return;
      }

      // Call Owner Approval endpoint
      const res = await fetch('/api/owner/approve-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: activeReviewRequest.id,
          collegeId: targetCollegeId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve application.');
      }

      // Check if email delivery had a warning
      if (data.emailWarning) {
        showToast({
          type: 'info',
          title: 'Admin Approved (Email Notice)',
          message: `User promoted to College Administrator. Note: ${data.emailWarning}`,
        });
      } else {
        showToast({
          type: 'success',
          title: 'Admin Application Approved 🎉',
          message: `${activeReviewRequest.full_name} is now promoted to College Administrator for ${data.assignedCollegeName || 'the assigned campus'}. Confirmation email dispatched to applicant.`,
        });
      }

      // Update request in state
      const assignedCol = colleges.find(c => c.id === targetCollegeId);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === activeReviewRequest.id
            ? {
                ...r,
                status: 'approved',
                college_id: targetCollegeId,
                assigned_college_id: targetCollegeId,
                assignedCollegeName: data.assignedCollegeName || assignedCol?.name || 'Assigned College',
                reviewed_at: new Date().toISOString()
              }
            : r
        )
      );

      setIsReviewModalOpen(false);
    } catch (err: any) {
      console.error('Approval Error:', err);
      showToast({
        type: 'error',
        title: 'Approval Failed',
        message: err.message || 'Server rejected the administrative action.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Reject Action
  const handleRejectAction = async () => {
    if (!activeReviewRequest || isActionLoading) return;

    try {
      setIsActionLoading(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/reject-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: activeReviewRequest.id,
          reason: rejectionReason.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline application.');
      }

      // Check if email delivery had a warning
      if (data.emailWarning) {
        showToast({
          type: 'info',
          title: 'Application Declined (Email Notice)',
          message: `Application declined. Note: ${data.emailWarning}`,
        });
      } else {
        showToast({
          type: 'info',
          title: 'Application Declined',
          message: `Application for ${activeReviewRequest.full_name} has been rejected. Notification email sent to applicant.`,
        });
      }

      // Update request in state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === activeReviewRequest.id
            ? {
                ...r,
                status: 'rejected',
                rejection_reason: rejectionReason.trim() || 'Credentials could not be verified',
                reviewed_at: new Date().toISOString()
              }
            : r
        )
      );

      setIsReviewModalOpen(false);
    } catch (err: any) {
      console.error('Rejection Error:', err);
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not record application rejection.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Securely view/download proof document
  const handleViewProof = async (req: ParsedAdminRequest) => {
    const proofPath = req.college_proof_path;
    if (!proofPath) {
      showToast({
        type: 'info',
        title: 'No Proof Document',
        message: 'No institutional proof file was uploaded with this application.',
      });
      return;
    }

    setPreviewDocName(`${req.full_name}'s Institutional Proof Document`);
    setIsLoadingProofUrl(true);

    try {
      const signedUrl = await getProofDocumentSignedUrl(proofPath);
      if (signedUrl) {
        setPreviewProofUrl(signedUrl);
        setIsPreviewModalOpen(true);
      } else {
        // If it's a file reference
        const displayRef = proofPath.replace(/^file_reference:/, '');
        showToast({
          type: 'info',
          title: 'Proof Record Reference',
          message: `Verification file reference: ${displayRef}`,
        });
      }
    } catch (err: any) {
      console.error('Proof URL Error:', err);
      showToast({
        type: 'error',
        title: 'Document Access Error',
        message: 'Could not generate secure signed URL for proof document.',
      });
    } finally {
      setIsLoadingProofUrl(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Retrieving administrator applications &amp; verification proofs..." />
      </div>
    );
  }

  // Find currently selected college object in Review Modal
  const currentAssignedCollege = colleges.find(c => c.id === selectedExistingCollegeId);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in" id="owner-admin-requests-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <span>College Admin Verification Requests</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Review applicant identities, free-text campus name requests, and private verification documents.
            The Foundly Platform Owner decides whether to assign an existing campus or establish a new institutional directory.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={loadData}
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
        >
          Refresh Requests
        </Button>
      </div>

      {/* Status Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'approved' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.approved}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'rejected' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.rejected}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>All Applications</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.all}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, college..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Applications List */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        {filteredRequests.length === 0 ? (
          <EmptyState
            title={
              searchQuery
                ? 'No matching applications found'
                : activeTab === 'pending'
                ? 'No pending admin applications'
                : activeTab === 'approved'
                ? 'No approved administrators recorded yet'
                : activeTab === 'rejected'
                ? 'No declined applications recorded'
                : 'No administrator applications found'
            }
            description={
              searchQuery
                ? 'Try adjusting your search criteria.'
                : 'When campus staff submit verification applications from /admin-application, their requests queue here for review.'
            }
            icon={<ShieldCheck className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const statusNormalized = (req.status || 'pending').toLowerCase();
              const isPending = statusNormalized === 'pending';
              const isApproved = statusNormalized === 'approved';
              const isRejected = statusNormalized === 'rejected';

              return (
                <div
                  key={req.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-start justify-between gap-5 ${
                    isPending
                      ? 'border-amber-200/70 bg-amber-50/20 hover:border-amber-300'
                      : isApproved
                      ? 'border-emerald-200/60 bg-emerald-50/10'
                      : 'border-slate-200/70 bg-slate-50/30'
                  }`}
                >
                  <div className="space-y-3 min-w-0 flex-1">
                    {/* Header Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {req.full_name}
                      </span>

                      {/* Status Badge */}
                      <StatusBadge 
                        status={
                          isPending ? 'PENDING' : isApproved ? 'APPROVED' : 'REJECTED'
                        } 
                        size="sm" 
                      />

                      {/* Requested College Pill */}
                      <span className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-indigo-600" />
                        <span>Requested: {req.extractedCollegeName}</span>
                      </span>

                      {/* Staff / Officer ID Pill */}
                      <span className="text-[11px] text-slate-700 font-medium bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3 text-slate-500" />
                        <span>ID: {req.extractedStaffId}</span>
                      </span>

                      {/* If Approved, show Assigned College Pill */}
                      {isApproved && (req.assignedCollegeName || req.colleges?.name) && (
                        <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Assigned: {req.assignedCollegeName || req.colleges?.name}</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata Details Row */}
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{req.email}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(req.email, 'Email address')}
                          className="text-slate-400 hover:text-slate-600 ml-0.5"
                          title="Copy Email"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>

                      <span className="text-slate-300">•</span>

                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{req.phone || 'No phone recorded'}</span>
                      </span>

                      <span className="text-slate-300">•</span>

                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Applied {new Date(req.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}</span>
                      </span>
                    </div>

                    {/* Statement of Intent */}
                    <div className="text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200/70 leading-relaxed shadow-2xs">
                      <p className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                        Role &amp; Statement of Intent
                      </p>
                      <p className="italic text-slate-800">
                        "{req.cleanStatement || 'No personal statement provided.'}"
                      </p>
                    </div>

                    {/* If Rejected: Show Reason */}
                    {isRejected && req.rejection_reason && (
                      <div className="text-xs text-rose-800 bg-rose-50/80 p-3 rounded-xl border border-rose-200/80 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold block text-[11px] text-rose-900 uppercase">
                            Rejection Reason On File:
                          </strong>
                          <span>{req.rejection_reason}</span>
                        </div>
                      </div>
                    )}

                    {/* Verification Document Reference Button */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {req.college_proof_path ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewProof(req)}
                          className="text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 h-8 px-2.5 font-medium border border-indigo-200/60 rounded-xl"
                          leftIcon={<FileText className="w-3.5 h-3.5 text-indigo-600" />}
                          rightIcon={<ExternalLink className="w-3 h-3 text-indigo-400" />}
                        >
                          View Verification Document
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" />
                          <span>No file uploaded with this application</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center lg:flex-col gap-2 shrink-0 pt-2 lg:pt-0">
                    {isPending ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openReviewModal(req)}
                        leftIcon={<ShieldCheck className="w-4 h-4" />}
                        className="w-full lg:w-40 justify-center shadow-xs"
                      >
                        Review Request
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReviewModal(req)}
                        leftIcon={<Eye className="w-4 h-4 text-slate-500" />}
                        className="w-full lg:w-40 justify-center"
                      >
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Governance Notice */}
      <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-xs text-indigo-950 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-indigo-950">Foundly Platform Owner Governance Mandate</p>
          <p className="text-indigo-800 leading-relaxed text-[11px]">
            Applicant college names are free-text suggestions. An applicant never automatically creates a campus directory or acquires administrator privileges upon submission. The Foundly Platform Owner makes the final decision: either linking the applicant to an existing active campus or provisioning a new institutional directory.
          </p>
        </div>
      </div>

      {/* DETAILED ADMIN REQUEST REVIEW MODAL */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Admin Request Verification & Decision"
        description={`Reviewing credentials for ${activeReviewRequest?.full_name}`}
        maxWidth="lg"
      >
        {activeReviewRequest && (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Visual Step Review Flow Header */}
            <div className="bg-slate-100/80 p-3 rounded-2xl border border-slate-200 text-[11px] text-slate-600">
              <span className="font-bold text-slate-800 uppercase tracking-wider block text-[10px] mb-1.5">
                Owner Review Protocol Flow:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap font-medium">
                <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-indigo-700 font-semibold">
                  1. Applicant Info
                </span>
                <span className="text-slate-400">→</span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-indigo-700 font-semibold">
                  2. Requested College
                </span>
                <span className="text-slate-400">→</span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-indigo-700 font-semibold">
                  3. Verification Proof
                </span>
                <span className="text-slate-400">→</span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-indigo-700 font-semibold">
                  4. College Assignment
                </span>
                <span className="text-slate-400">→</span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-indigo-700 font-semibold">
                  5. Decision
                </span>
              </div>
            </div>

            {/* STEP 1: Applicant Information */}
            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-indigo-600" />
                <span>1. Applicant Information</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Applicant Full Name</span>
                  <span className="text-slate-900 font-bold text-sm">{activeReviewRequest.full_name}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Applicant Email</span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-900 font-medium">{activeReviewRequest.email}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeReviewRequest.email, 'Email address')}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Contact Phone</span>
                  <span className="text-slate-800 font-medium">
                    {activeReviewRequest.phone || 'Not provided'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Staff / Employee ID</span>
                  <span className="text-indigo-900 font-bold">
                    {activeReviewRequest.extractedStaffId}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                  Role / Statement of Intent
                </span>
                <p className="italic text-slate-800 leading-relaxed">
                  "{activeReviewRequest.cleanStatement || 'No personal statement provided.'}"
                </p>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Application Submitted: {new Date(activeReviewRequest.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* STEP 2: Requested College */}
            <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 shadow-2xs">
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>2. Requested College / University</span>
              </h3>

              <div className="p-3 rounded-xl bg-white border border-indigo-100 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                  Applicant's Free-Text College Input:
                </span>
                <p className="text-base font-bold text-indigo-950">
                  {activeReviewRequest.extractedCollegeName}
                </p>
                
                {/* Match evaluation banner */}
                {colleges.some(c => c.name.toLowerCase() === activeReviewRequest.extractedCollegeName.toLowerCase()) ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Exact campus match found in active directory!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium pt-1">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    <span>This institution is not currently registered. You can create it in Step 4 below.</span>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 3: Verification Proof Document */}
            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>3. Institutional Verification Proof</span>
              </h3>

              {activeReviewRequest.college_proof_path ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      Private Institutional Proof Document
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-sm">
                      Storage Reference: {activeReviewRequest.college_proof_path.replace(/^file_reference:/, '')}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewProof(activeReviewRequest)}
                    disabled={isLoadingProofUrl}
                    leftIcon={<Eye className="w-3.5 h-3.5 text-indigo-600" />}
                    rightIcon={<ExternalLink className="w-3 h-3 text-slate-400" />}
                    className="shrink-0"
                  >
                    {isLoadingProofUrl ? 'Generating URL...' : 'View Document'}
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
                  No digital credential document was uploaded with this application.
                </div>
              )}
            </div>

            {/* STEP 4: College Assignment Decision (Only for Pending, or review past for Approved) */}
            {activeReviewRequest.status === 'pending' ? (
              <div className="space-y-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>4. College Campus Assignment</span>
                  </h3>
                  <span className="text-[11px] text-indigo-600 font-semibold">
                    Requested: "{activeReviewRequest.extractedCollegeName}"
                  </span>
                </div>

                {/* Mode Selector Tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollegeAssignMode('existing')}
                    disabled={colleges.length === 0}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition-all ${
                      collegeAssignMode === 'existing'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    } ${colleges.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>Assign Existing College</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Choose from {colleges.length} onboarded campus directories
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCollegeAssignMode('new')}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition-all ${
                      collegeAssignMode === 'new'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <PlusCircle className="w-4 h-4 text-indigo-600" />
                      <span>+ Create New College</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Register new campus directory &amp; link applicant
                    </span>
                  </button>
                </div>

                {/* Assignment Form Section */}
                {collegeAssignMode === 'existing' ? (
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Search &amp; Select Existing College Directory
                      </label>
                      <input
                        type="text"
                        value={collegeSearchQuery}
                        onChange={(e) => setCollegeSearchQuery(e.target.value)}
                        placeholder="Filter colleges by name or code..."
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <Select
                      label="Assigned Campus"
                      value={selectedExistingCollegeId}
                      onChange={(e) => setSelectedExistingCollegeId(e.target.value)}
                      options={filteredColleges.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.code})${c.city ? ` — ${c.city}, ${c.state || ''}` : ''}`,
                      }))}
                      placeholder="Select campus directory..."
                      requiredIndicator
                    />

                    {currentAssignedCollege && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                        <div>
                          <span className="font-semibold block">Will assign administrator to:</span>
                          <span className="font-bold text-emerald-950">{currentAssignedCollege.name} ({currentAssignedCollege.code})</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Create New Institutional Directory
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Will be saved to colleges table and assigned
                      </span>
                    </div>

                    <Input
                      label="College / University Full Name"
                      value={newCollegeName}
                      onChange={(e) => setNewCollegeName(e.target.value)}
                      placeholder="e.g. Harvard University"
                      requiredIndicator
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        label="Short Code"
                        value={newCollegeCode}
                        onChange={(e) => setNewCollegeCode(e.target.value.toUpperCase())}
                        placeholder="e.g. HARV"
                        requiredIndicator
                      />
                      <Input
                        label="City (Optional)"
                        value={newCollegeCity}
                        onChange={(e) => setNewCollegeCity(e.target.value)}
                        placeholder="Cambridge"
                      />
                      <Input
                        label="State (Optional)"
                        value={newCollegeState}
                        onChange={(e) => setNewCollegeState(e.target.value)}
                        placeholder="MA"
                      />
                    </div>

                    <Input
                      label="Campus Email Domain / Whitelist (Optional)"
                      value={newCollegeDomain}
                      onChange={(e) => setNewCollegeDomain(e.target.value)}
                      placeholder="e.g. harvard.edu"
                    />

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCreateCollegeFromReview}
                        disabled={isCreatingCollege || isActionLoading}
                        leftIcon={<PlusCircle className="w-3.5 h-3.5 text-indigo-600" />}
                      >
                        {isCreatingCollege ? 'Registering...' : 'Create & Select College'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Review History for Approved or Rejected */
              <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Review Decision History</span>
                </h3>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Current Status:</span>
                    <StatusBadge
                      status={
                        activeReviewRequest.status === 'approved' ? 'APPROVED' : 'REJECTED'
                      }
                      size="sm"
                    />
                  </div>

                  {activeReviewRequest.status === 'approved' && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Assigned College:</span>
                      <span className="font-bold text-slate-900">
                        {activeReviewRequest.assignedCollegeName || activeReviewRequest.colleges?.name || 'Assigned College'}
                      </span>
                    </div>
                  )}

                  {activeReviewRequest.status === 'rejected' && (
                    <div className="space-y-1">
                      <span className="text-slate-500">Recorded Rejection Reason:</span>
                      <p className="font-medium text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        {activeReviewRequest.rejection_reason || 'No specific reason recorded.'}
                      </p>
                    </div>
                  )}

                  {activeReviewRequest.reviewed_at && (
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200">
                      <span>Reviewed At:</span>
                      <span>{new Date(activeReviewRequest.reviewed_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: Final Decision (Approve / Reject) */}
            {activeReviewRequest.status === 'pending' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>5. Review Decision</span>
                </h3>

                {!showRejectForm ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectForm(true)}
                      disabled={isActionLoading}
                      leftIcon={<X className="w-4 h-4 text-rose-600" />}
                      className="w-full sm:w-auto text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                    >
                      Decline Application...
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleApproveAction}
                      disabled={isActionLoading}
                      leftIcon={<Check className="w-4 h-4" />}
                      className="w-full sm:w-auto shadow-xs"
                    >
                      {isActionLoading ? 'Authorizing & Promoting...' : 'Approve & Promote Admin'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 rounded-xl bg-white border border-rose-200 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Decline Application Reason</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRejectForm(false)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>

                    <Textarea
                      label="Rejection Reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Could not verify staff credentials with campus directory; invalid employee ID format..."
                      rows={3}
                      requiredIndicator
                    />

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isActionLoading}
                        onClick={() => setShowRejectForm(false)}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isActionLoading}
                        onClick={handleRejectAction}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        {isActionLoading ? 'Declining...' : 'Confirm Rejection'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReviewModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* PROOF DOCUMENT VIEWER MODAL */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Institutional Verification Proof"
        description={previewDocName}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {previewProofUrl ? (
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center">
              {previewProofUrl.includes('.pdf') ? (
                <iframe
                  src={previewProofUrl}
                  title="Institutional Proof Document"
                  className="w-full h-96 rounded-lg border border-slate-300"
                />
              ) : (
                <img
                  src={previewProofUrl}
                  alt="Staff Credential Proof"
                  className="max-h-96 w-auto rounded-lg object-contain shadow-xs"
                />
              )}
              <div className="pt-3 w-full flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Secure 1-hour signed private access link
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewProofUrl}
                    download="institutional_proof"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <span>•</span>
                  <a
                    href={previewProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Full Window</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">
              Document could not be rendered or no signed link was generated.
            </p>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
