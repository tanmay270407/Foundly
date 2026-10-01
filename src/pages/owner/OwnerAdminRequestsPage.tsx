import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, X, Building2, Mail, Phone, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const OwnerAdminRequestsPage: React.FC = () => {
  const { showToast } = useToast();
  const { session } = useAuth();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Rejection modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedApplicantName, setSelectedApplicantName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const loadRequests = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('admin_requests')
        .select('*, colleges(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Error loading admin requests:', err);
      showToast({
        type: 'error',
        title: 'Query Failed',
        message: 'Could not load pending college admin applications.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string, name: string) => {
    if (isActionLoading) return;
    try {
      setIsActionLoading(true);
      const token = session?.access_token;
      
      const res = await fetch('/api/owner/approve-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId: id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve request.');

      showToast({
        type: 'success',
        title: 'Admin Approved 🎉',
        message: `${name} is promoted to College Admin.`,
      });

      // Filter out approved request
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error('Approval API Error:', err);
      showToast({
        type: 'error',
        title: 'Approval Failed',
        message: err.message || 'Server rejected the administrative action.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const openRejectModal = (id: string, name: string) => {
    setSelectedRequestId(id);
    setSelectedApplicantName(name);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId || isActionLoading) return;
    if (!rejectionReason.trim()) {
      showToast({
        type: 'error',
        title: 'Input Required',
        message: 'Please provide a justification for declining this staff application.',
      });
      return;
    }

    try {
      setIsActionLoading(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/reject-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId: selectedRequestId, reason: rejectionReason.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject application.');

      showToast({
        type: 'info',
        title: 'Application Rejected',
        message: `Application for ${selectedApplicantName} has been declined.`,
      });

      setRequests((prev) => prev.filter((r) => r.id !== selectedRequestId));
      setIsRejectModalOpen(false);
    } catch (err: any) {
      console.error('Rejection API Error:', err);
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not record application rejection.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Retrieving applicant verifications..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in" id="owner-admin-requests-root">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          College Admin Verification Requests
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review staff credential proofs submitted from /admin-application. Only the Foundly Owner can authorize College Admin role.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        {requests.length === 0 ? (
          <EmptyState
            title="No pending admin applications"
            description="When campus staff apply for administrative access, their institutional verification documents and ID records will queue here for Owner review."
            icon={<ShieldCheck className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{req.full_name}</span>
                    <StatusBadge status={req.status} size="sm" />
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>{req.colleges?.name} ({req.colleges?.code})</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{req.email}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{req.phone || 'No phone recorded'}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Submitted {new Date(req.created_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 mt-3 bg-white p-4 rounded-xl border border-slate-200/60 leading-relaxed">
                    <p className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider mb-1">Applicant Statement</p>
                    "{req.reason}"
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isActionLoading}
                    onClick={() => openRejectModal(req.id, req.full_name)}
                    leftIcon={<X className="w-4 h-4 text-rose-600" />}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isActionLoading}
                    onClick={() => handleApprove(req.id, req.full_name)}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Approve Admin
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Architecture Reminder */}
      <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900">
        <p className="font-semibold">Security Governance Mandate (Section 2 & 17):</p>
        <p className="text-purple-800 mt-0.5 leading-relaxed">
          Students must never gain administrative privileges simply by selecting "Admin" during signup. All College Admin candidates are queued with <code className="bg-purple-100 font-mono px-1 py-0.5 rounded">status = PENDING</code> until explicitly authorized here.
        </p>
      </div>

      {/* Rejection Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Decline Administrator Application"
        description={`State the reason for rejecting ${selectedApplicantName}'s application. This will be visible to the applicant.`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <p>Declining this application will notify the applicant immediately and keep their account role as student.</p>
          </div>

          <Textarea
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Invalid staff email domain provided, credentials could not be verified by campus office..."
            requiredIndicator
            rows={4}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isActionLoading}
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isActionLoading}
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
