import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  ShieldCheck,
  Mail,
  Loader2,
  User,
  Calendar,
  MapPin,
  Lock,
  Eye,
  PlayCircle,
  Search,
  Link2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, safeUpdate } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { Textarea } from '../../components/ui/Textarea';
import { Claim, Item, CATEGORIES } from '../../types';

interface ClaimWithDetails extends Claim {
  items?: Item;
  profiles?: {
    full_name: string;
    email: string;
  };
}

function getLinkedLostReportId(claim: Claim | null | undefined): string | null {
  if (!claim) return null;
  if (claim.lost_item_id && String(claim.lost_item_id).trim()) {
    return String(claim.lost_item_id).trim();
  }
  const msg = String(claim.additional_message || '');
  const match = msg.match(/\[Linked Lost Report:\s*([0-9a-fA-F-]{36})\]/i);
  return match?.[1] || null;
}

type ClaimTab = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'HANDOVER' | 'REJECTED' | 'COMPLETED';

export interface AdminClaimsPageProps {
  mode?: 'ALL' | 'VERIFICATION' | 'HANDOVER';
}

export const AdminClaimsPage: React.FC<AdminClaimsPageProps> = ({ mode = 'ALL' }) => {
  const { profile, user, session, configuredCollege } = useAuth();
  const { search } = useRouter();
  const { showToast } = useToast();

  const defaultTabForMode = (m: 'ALL' | 'VERIFICATION' | 'HANDOVER'): ClaimTab => {
    if (m === 'VERIFICATION') return 'PENDING';
    if (m === 'HANDOVER') return 'APPROVED';
    return 'PENDING';
  };

  const [activeTab, setActiveTab] = useState<ClaimTab>(defaultTabForMode(mode));
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    setActiveTab(defaultTabForMode(mode));
  }, [mode]);

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const params = new URLSearchParams(search || window.location.search);
    return params.get('search') || '';
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const q = params.get('search');
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [search]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [selectedClaim, setSelectedClaim] = useState<ClaimWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [isGeneratingProofUrl, setIsGeneratingProofUrl] = useState(false);
  const [linkedLostReport, setLinkedLostReport] = useState<Item | null>(null);
  const [isLoadingLinkedLost, setIsLoadingLinkedLost] = useState(false);

  const [isStatusTransitioning, setIsStatusTransitioning] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  const targetCollegeId = profile?.college_id || configuredCollege?.id;

  const fetchClaims = async () => {
    if (!isSupabaseConfigured() || !targetCollegeId) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*, items(*), profiles:claimant_id(full_name, email)')
        .eq('college_id', targetCollegeId)
        .order('created_at', { ascending: false });

      if (error) {
        showToast({
          type: 'error',
          title: 'Error loading claims',
          message: error.message,
        });
      } else if (data) {
        const formatted = data.map((c: any) => ({
          ...c,
          status: (c.status || 'PENDING').toUpperCase(),
          items: c.items
            ? {
                ...c.items,
                type: (c.items.type || 'FOUND').toUpperCase(),
                status: (c.items.status || 'PENDING').toUpperCase(),
              }
            : undefined,
          profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
        })) as ClaimWithDetails[];
        setClaims(formatted);
      }
    } catch (err: any) {
      console.error('Error fetching claims:', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [targetCollegeId]);

  useEffect(() => {
    let isMounted = true;
    async function loadPrivateProof() {
      if (!selectedClaim?.ownership_proof_path) {
        setProofUrl(null);
        return;
      }
      setIsGeneratingProofUrl(true);
      try {
        const { data, error } = await supabase.storage
          .from('claim-proofs')
          .createSignedUrl(selectedClaim.ownership_proof_path, 3600);

        if (isMounted) {
          if (!error && data) {
            setProofUrl(data.signedUrl);
          } else {
            setProofUrl(null);
          }
        }
      } catch {
        if (isMounted) setProofUrl(null);
      } finally {
        if (isMounted) setIsGeneratingProofUrl(false);
      }
    }

    loadPrivateProof();

    async function loadLinkedLostReport() {
      const lostId = getLinkedLostReportId(selectedClaim);
      if (!lostId || !isSupabaseConfigured()) {
        if (isMounted) {
          setLinkedLostReport(null);
          setIsLoadingLinkedLost(false);
        }
        return;
      }
      setIsLoadingLinkedLost(true);
      try {
        const { data } = await supabase
          .from('items')
          .select('*')
          .eq('id', lostId)
          .maybeSingle();
        if (isMounted) {
          setLinkedLostReport(
            data
              ? ({
                  ...data,
                  type: (data.type || 'LOST').toUpperCase(),
                  status: (data.status || 'PUBLISHED').toUpperCase(),
                } as Item)
              : null
          );
        }
      } catch {
        if (isMounted) setLinkedLostReport(null);
      } finally {
        if (isMounted) setIsLoadingLinkedLost(false);
      }
    }

    loadLinkedLostReport();

    return () => {
      isMounted = false;
    };
  }, [selectedClaim]);

  const checkCurrentClaimState = async (claimId: string): Promise<ClaimWithDetails | null> => {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*, items(*)')
        .eq('id', claimId)
        .single();
      if (error || !data) return null;
      return data as ClaimWithDetails;
    } catch {
      return null;
    }
  };

  const handleStartReview = async () => {
    if (!selectedClaim || !user || !profile) return;

    setIsStatusTransitioning(true);
    try {
      const currentClaim = await checkCurrentClaimState(selectedClaim.id);
      if (!currentClaim || currentClaim.status.toUpperCase() !== 'PENDING') {
        showToast({
          type: 'error',
          title: 'Status Changed',
          message: 'This claim was already updated.',
        });
        setIsDetailsOpen(false);
        setSelectedClaim(null);
        fetchClaims();
        return;
      }

      const { error } = await safeUpdate('claims', 'id', selectedClaim.id, {
        status: 'under_review',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      });

      if (error) {
        showToast({
          type: 'error',
          title: 'Error Starting Review',
          message: error.message,
        });
        return;
      }

      try {
        await supabase.from('notifications').insert({
          user_id: selectedClaim.claimant_id,
          college_id: selectedClaim.college_id,
          title: 'Your claim is now under review.',
          message: `Your ownership claim for "${selectedClaim.items?.item_name || 'your lost item'}" is now being reviewed by your campus administrator.`,
          type: `CLAIM_REVIEW_STARTED:${selectedClaim.item_id}`,
          read: false,
        });
      } catch (notifErr) {
        console.warn('Notification insert skipped:', notifErr);
      }

      try {
        await supabase.from('activity_logs').insert({
          actor_id: user.id,
          college_id: selectedClaim.college_id,
          action: 'CLAIM_REVIEW_STARTED',
          entity_type: 'CLAIM',
          entity_id: selectedClaim.id,
          metadata: {
            item_name: selectedClaim.items?.item_name,
            claimant_name: selectedClaim.profiles?.full_name,
            reviewer_email: profile.email,
          },
        });
      } catch (logErr) {
        console.warn('Activity log insert skipped:', logErr);
      }

      showToast({
        type: 'success',
        title: 'Under Review',
        message: 'Claim moved to review.',
      });

      fetchClaims();
      setSelectedClaim((prev) => (prev ? { ...prev, status: 'UNDER_REVIEW' } : null));
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  const handleApproveClaim = async () => {
    if (!selectedClaim || !user || !profile) return;

    setIsStatusTransitioning(true);
    try {
      const currentClaim = await checkCurrentClaimState(selectedClaim.id);
      if (!currentClaim || currentClaim.status.toUpperCase() !== 'UNDER_REVIEW') {
        showToast({
          type: 'error',
          title: 'Status Changed',
          message: 'Claim is no longer under review.',
        });
        setIsApproveOpen(false);
        setIsDetailsOpen(false);
        setSelectedClaim(null);
        fetchClaims();
        return;
      }

      const timestamp = new Date().toISOString();

      const { error } = await safeUpdate('claims', 'id', selectedClaim.id, {
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: timestamp,
      });

      if (error) {
        showToast({
          type: 'error',
          title: 'Approval Failed',
          message: error.message,
        });
        return;
      }

      try {
        await supabase.from('notifications').insert({
          user_id: selectedClaim.claimant_id,
          college_id: selectedClaim.college_id,
          title: 'Your claim was approved.',
          message: `Your ownership claim for "${selectedClaim.items?.item_name || 'your item'}" has been approved. The item is ready for handover scheduling.`,
          type: `CLAIM_APPROVED:${selectedClaim.item_id}`,
          read: false,
        });
      } catch (notifErr) {
        console.warn('Notification insert skipped:', notifErr);
      }

      try {
        await supabase.from('activity_logs').insert({
          actor_id: user.id,
          college_id: selectedClaim.college_id,
          action: 'CLAIM_APPROVED',
          entity_type: 'CLAIM',
          entity_id: selectedClaim.id,
          metadata: {
            item_name: selectedClaim.items?.item_name,
            claimant_name: selectedClaim.profiles?.full_name,
            reviewer_email: profile.email,
          },
        });
      } catch (logErr) {
        console.warn('Activity log insert skipped:', logErr);
      }

      showToast({
        type: 'success',
        title: 'Claim Approved',
        message: `Approved claim for ${selectedClaim.profiles?.full_name || 'student'}.`,
      });

      setIsApproveOpen(false);
      setIsDetailsOpen(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  const handleRejectClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !user || !profile) return;

    setIsStatusTransitioning(true);
    try {
      const currentClaim = await checkCurrentClaimState(selectedClaim.id);
      if (!currentClaim || currentClaim.status.toUpperCase() !== 'UNDER_REVIEW') {
        showToast({
          type: 'error',
          title: 'Status Changed',
          message: 'Claim is no longer under review.',
        });
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        setSelectedClaim(null);
        fetchClaims();
        return;
      }

      const timestamp = new Date().toISOString();

      const { error } = await safeUpdate('claims', 'id', selectedClaim.id, {
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: timestamp,
        rejection_reason: rejectionReason.trim() || null,
      });

      if (error) {
        showToast({
          type: 'error',
          title: 'Rejection Failed',
          message: error.message,
        });
        return;
      }

      const reasonText = rejectionReason.trim()
        ? ` Reason: "${rejectionReason.trim()}".`
        : ' Verification credentials could not be validated.';
      try {
        await supabase.from('notifications').insert({
          user_id: selectedClaim.claimant_id,
          college_id: selectedClaim.college_id,
          title: 'Your claim was rejected.',
          message: `Your ownership claim for "${selectedClaim.items?.item_name || 'your lost item'}" was rejected.${reasonText}`,
          type: `CLAIM_REJECTED:${selectedClaim.item_id}`,
          read: false,
        });
      } catch (notifErr) {
        console.warn('Notification insert skipped:', notifErr);
      }

      try {
        await supabase.from('activity_logs').insert({
          actor_id: user.id,
          college_id: selectedClaim.college_id,
          action: 'CLAIM_REJECTED',
          entity_type: 'CLAIM',
          entity_id: selectedClaim.id,
          metadata: {
            item_name: selectedClaim.items?.item_name,
            claimant_name: selectedClaim.profiles?.full_name,
            rejection_reason: rejectionReason.trim() || undefined,
            reviewer_email: profile.email,
          },
        });
      } catch (logErr) {
        console.warn('Activity log insert skipped:', logErr);
      }

      showToast({
        type: 'success',
        title: 'Claim Rejected',
        message: `Rejected claim from ${selectedClaim.profiles?.full_name || 'student'}.`,
      });

      setIsRejectOpen(false);
      setRejectionReason('');
      setIsDetailsOpen(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  const handleMoveToHandover = async () => {
    if (!selectedClaim) return;
    if (!session?.access_token) {
      showToast({
        type: 'error',
        title: 'Session Expired',
        message: 'Please sign in again.',
      });
      return;
    }

    setIsStatusTransitioning(true);
    try {
      const response = await fetch('/api/claim/handover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ claimId: selectedClaim.id }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to move claim to handover.');
      }

      showToast({
        type: 'success',
        title: 'Ready for Handover',
        message: 'Claim and item moved to handover.',
      });

      setIsDetailsOpen(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Transition Failed',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    if (!session?.access_token) {
      showToast({
        type: 'error',
        title: 'Session Expired',
        message: 'Please sign in again.',
      });
      return;
    }

    setIsStatusTransitioning(true);
    try {
      const response = await fetch('/api/claim/confirm-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          claimId: selectedClaim.id,
          handoverNotes: handoverNotes.trim() || undefined,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to confirm return.');
      }

      showToast({
        type: 'success',
        title: 'Return Confirmed',
        message: 'Item marked returned and case closed.',
      });

      setIsReturnOpen(false);
      setHandoverNotes('');
      setIsDetailsOpen(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Operation Failed',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  const visibleTabs: ClaimTab[] =
    mode === 'VERIFICATION'
      ? ['PENDING', 'UNDER_REVIEW', 'REJECTED']
      : mode === 'HANDOVER'
      ? ['APPROVED', 'HANDOVER', 'COMPLETED']
      : ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'HANDOVER', 'REJECTED', 'COMPLETED'];

  const filteredClaims = claims.filter((c) => {
    if (c.status !== activeTab) return false;
    if (categoryFilter !== 'ALL' && c.items?.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const itemName = c.items?.item_name || '';
      const claimId = c.id || '';
      const claimantName = c.profiles?.full_name || '';
      const claimantEmail = c.profiles?.email || '';
      const matchesItem = itemName.toLowerCase().includes(q);
      const matchesId = claimId.toLowerCase().includes(q);
      const matchesClaimant =
        claimantName.toLowerCase().includes(q) || claimantEmail.toLowerCase().includes(q);
      if (!matchesItem && !matchesId && !matchesClaimant) return false;
    }

    return true;
  });

  const pageTitle =
    mode === 'VERIFICATION'
      ? 'Verification'
      : mode === 'HANDOVER'
      ? 'Handover & Returns'
      : 'Claims';

  const tabDisplayNames: Record<ClaimTab, string> = {
    PENDING: 'Pending',
    UNDER_REVIEW: 'In Review',
    APPROVED: 'Approved',
    HANDOVER: 'Handover',
    REJECTED: 'Rejected',
    COMPLETED: 'Returned',
  };

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{pageTitle}</h1>

        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-slate-100/70 p-1">
          {visibleTabs.map((tab) => {
            const count = claims.filter((c) => c.status === tab).length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors tabular-nums ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tabDisplayNames[tab]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2.5">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search item, claim ID, or claimant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              ...CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') })),
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isFetching ? (
          <LoadingState message="Loading claims..." />
        ) : filteredClaims.length === 0 ? (
          <EmptyState
            className="border-0 rounded-none"
            title={`No ${tabDisplayNames[activeTab].toLowerCase()} claims`}
            icon={<CheckSquare className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4">Claimant</th>
                  <th className="py-2.5 px-4">Submitted</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {claim.items?.item_name || 'Item'}
                      </div>
                      {getLinkedLostReportId(claim) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 mt-0.5">
                          <Link2 className="w-3 h-3" />
                          Linked lost report
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {claim.profiles?.full_name || 'Student'}
                      </div>
                      {claim.profiles?.email && (
                        <div className="text-[11px] text-slate-400">{claim.profiles.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={claim.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setSelectedClaim(claim);
                          setIsDetailsOpen(true);
                        }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verification Dossier Modal */}
      {selectedClaim && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedClaim(null);
          }}
          title={selectedClaim.items?.item_name || 'Claim Verification'}
          maxWidth="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Found Item Record */}
            <div className="space-y-4 md:border-r md:border-slate-100 md:pr-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">Found Item</h4>
                {selectedClaim.items && <StatusBadge status={selectedClaim.items.status} size="sm" />}
              </div>

              {selectedClaim.items?.image_path && (
                <div className="aspect-video rounded-lg bg-slate-50 border border-slate-200/80 overflow-hidden">
                  <img
                    src={selectedClaim.items.image_path}
                    alt={selectedClaim.items.item_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block">Category</span>
                    <span className="font-medium text-slate-800">
                      {(selectedClaim.items?.category || 'OTHER').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Found Date</span>
                    <span className="font-medium text-slate-800 tabular-nums">
                      {selectedClaim.items?.date || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Location Found</span>
                    <span className="font-medium text-slate-800">
                      {selectedClaim.items?.location || '—'}
                    </span>
                  </div>
                </div>

                {selectedClaim.items?.unique_marks && (
                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70">
                    <span className="text-[11px] font-semibold text-amber-800 inline-flex items-center gap-1 mb-0.5">
                      <Lock className="w-3 h-3" /> Finder Private Marks
                    </span>
                    <p className="text-[11px] text-amber-950 font-mono">
                      {selectedClaim.items.unique_marks}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-0.5">Description</span>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedClaim.items?.description || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Claimant Evidence */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">Claim Submission</h4>
                <StatusBadge status={selectedClaim.status} size="sm" />
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1">
                  <p className="flex items-center gap-1.5 font-medium text-slate-900">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedClaim.profiles?.full_name || 'Student'}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedClaim.profiles?.email}</span>
                  </p>
                </div>

                {getLinkedLostReportId(selectedClaim) && (
                  <details
                    open
                    className="rounded-lg bg-indigo-50/40 border border-indigo-200/70 p-3 space-y-2"
                  >
                    <summary className="cursor-pointer text-xs font-semibold text-indigo-900 flex items-center justify-between list-none">
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                        Linked Lost Report
                      </span>
                      {linkedLostReport && <StatusBadge status={linkedLostReport.status} size="sm" />}
                    </summary>

                    {isLoadingLinkedLost ? (
                      <div className="flex items-center gap-2 text-slate-500 pt-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : linkedLostReport ? (
                      <div className="space-y-2 pt-2 border-t border-indigo-100">
                        <div className="flex items-start gap-2.5">
                          {linkedLostReport.image_path && (
                            <img
                              src={linkedLostReport.image_path}
                              alt={linkedLostReport.item_name}
                              className="w-11 h-11 rounded-md object-cover border border-slate-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {linkedLostReport.item_name}
                            </p>
                            <p className="text-slate-600 tabular-nums">
                              {linkedLostReport.location} · {linkedLostReport.date}
                            </p>
                            {(linkedLostReport.brand || linkedLostReport.color) && (
                              <p className="text-slate-500">
                                {[linkedLostReport.brand, linkedLostReport.color].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                        {linkedLostReport.description && (
                          <p className="text-slate-700 leading-relaxed">
                            {linkedLostReport.description}
                          </p>
                        )}
                        {linkedLostReport.unique_marks && (
                          <p className="font-mono text-[11px] bg-white rounded p-2 border border-indigo-100 text-slate-800">
                            {linkedLostReport.unique_marks}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 pt-1">
                        ID: {getLinkedLostReportId(selectedClaim)}
                      </p>
                    )}
                  </details>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block">Lost Date</span>
                    <span className="font-medium text-slate-800 inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {selectedClaim.lost_date || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Lost Location</span>
                    <span className="font-medium text-slate-800 inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {selectedClaim.lost_location || '—'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Ownership Explanation</span>
                  <p className="text-slate-700 bg-slate-50 border border-slate-200/70 p-2.5 rounded-lg leading-relaxed">
                    {selectedClaim.claim_explanation}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Identifying Marks</span>
                  <p className="text-slate-700 bg-slate-50 border border-slate-200/70 p-2.5 rounded-lg font-mono text-[11px]">
                    {selectedClaim.identifying_details || 'None provided'}
                  </p>
                </div>

                {selectedClaim.contact_information && (
                  <div>
                    <span className="text-slate-400 block">Contact</span>
                    <span className="font-medium text-slate-800">{selectedClaim.contact_information}</span>
                  </div>
                )}

                {selectedClaim.additional_message && (
                  <div>
                    <span className="text-slate-400 block">Notes</span>
                    <p className="text-slate-600">{selectedClaim.additional_message}</p>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-1">Proof Attachment</span>
                  {selectedClaim.ownership_proof_path ? (
                    isGeneratingProofUrl ? (
                      <div className="flex items-center gap-2 text-slate-400 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading proof...</span>
                      </div>
                    ) : proofUrl ? (
                      <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50">
                        {selectedClaim.ownership_proof_path.toLowerCase().endsWith('.pdf') ? (
                          <div className="p-3 text-center">
                            <a
                              href={proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 hover:underline font-medium"
                            >
                              Open PDF Proof
                            </a>
                          </div>
                        ) : (
                          <a href={proofUrl} target="_blank" rel="noreferrer">
                            <img
                              src={proofUrl}
                              alt="Ownership proof"
                              className="w-full max-h-40 object-contain"
                            />
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400">Unable to load proof file.</p>
                    )
                  ) : (
                    <p className="text-slate-400">No file attached.</p>
                  )}
                </div>

                {selectedClaim.handover_at && (
                  <p className="text-slate-500 tabular-nums">
                    Handover scheduled: {new Date(selectedClaim.handover_at).toLocaleString()}
                  </p>
                )}

                {selectedClaim.status === 'COMPLETED' && selectedClaim.completed_at && (
                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/70 rounded-lg space-y-1">
                    <p className="font-medium text-emerald-900 tabular-nums">
                      Returned: {new Date(selectedClaim.completed_at).toLocaleString()}
                    </p>
                    {selectedClaim.handover_notes && (
                      <p className="text-emerald-800">{selectedClaim.handover_notes}</p>
                    )}
                  </div>
                )}

                {selectedClaim.status === 'REJECTED' && selectedClaim.rejection_reason && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200/70 text-rose-800 rounded-lg">
                    <span className="font-medium">Rejected:</span> {selectedClaim.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
            {selectedClaim.status === 'PENDING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartReview}
                isLoading={isStatusTransitioning}
                leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
              >
                Start Review
              </Button>
            )}

            {selectedClaim.status === 'UNDER_REVIEW' && (
              <>
                <Button variant="danger" size="sm" onClick={() => setIsRejectOpen(true)}>
                  Reject
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsApproveOpen(true)}>
                  Approve
                </Button>
              </>
            )}

            {selectedClaim.status === 'APPROVED' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleMoveToHandover}
                isLoading={isStatusTransitioning}
                leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
              >
                Move to Handover
              </Button>
            )}

            {selectedClaim.status === 'HANDOVER' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsReturnOpen(true)}
                isLoading={isStatusTransitioning}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
              >
                Confirm Return
              </Button>
            )}
          </div>
        </Modal>
      )}

      <ConfirmationDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApproveClaim}
        title="Approve claim?"
        message={`Approve ownership claim from ${selectedClaim?.profiles?.full_name || 'this student'}?`}
        confirmLabel="Approve"
        isLoading={isStatusTransitioning}
      />

      {selectedClaim && (
        <Modal
          isOpen={isRejectOpen}
          onClose={() => {
            setIsRejectOpen(false);
            setRejectionReason('');
          }}
          title="Reject claim"
          maxWidth="sm"
        >
          <form onSubmit={handleRejectClaim} className="space-y-4">
            <Textarea
              label="Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why ownership could not be verified..."
              rows={3}
              requiredIndicator
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRejectOpen(false);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isStatusTransitioning}>
                Reject Claim
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {selectedClaim && (
        <Modal
          isOpen={isReturnOpen}
          onClose={() => {
            setIsReturnOpen(false);
            setHandoverNotes('');
          }}
          title="Confirm Return"
          description={`Confirm physical handover of "${selectedClaim.items?.item_name || 'item'}" to ${selectedClaim.profiles?.full_name || 'claimant'}.`}
          maxWidth="sm"
        >
          <form onSubmit={handleConfirmReturn} className="space-y-4">
            <Textarea
              label="Handover Notes (Optional)"
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Student ID verified at desk."
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsReturnOpen(false);
                  setHandoverNotes('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isStatusTransitioning}>
                Confirm Return
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
