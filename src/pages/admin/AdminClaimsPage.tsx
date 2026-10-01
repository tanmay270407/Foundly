import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  ShieldCheck, 
  Mail, 
  Inbox, 
  Loader2, 
  FileText, 
  User, 
  Calendar, 
  MapPin, 
  Clock, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  AlertTriangle,
  PlayCircle,
  ImageIcon,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
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

export const AdminClaimsPage: React.FC = () => {
  const { profile, user, session } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'HANDOVER' | 'REJECTED' | 'COMPLETED'>('PENDING');
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal / Review States
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [isGeneratingProofUrl, setIsGeneratingProofUrl] = useState(false);

  // Actions states
  const [isStatusTransitioning, setIsStatusTransitioning] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  // Fetch Claims
  const fetchClaims = async () => {
    if (!isSupabaseConfigured() || !profile?.college_id) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*, items(*), profiles:claimant_id(full_name, email)')
        .eq('college_id', profile.college_id)
        .order('created_at', { ascending: false });

      if (error) {
        showToast({
          type: 'error',
          title: 'Error loading claims',
          message: error.message,
        });
      } else if (data) {
        // Map states correctly
        const formatted = data.map((c: any) => ({
          ...c,
          status: (c.status || 'PENDING').toUpperCase(),
          items: c.items ? {
            ...c.items,
            type: (c.items.type || 'FOUND').toUpperCase(),
            status: (c.items.status || 'PENDING').toUpperCase(),
          } : undefined,
          profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
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
  }, [profile?.college_id]);

  // Load Secure signed URL for private proofs
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
          .createSignedUrl(selectedClaim.ownership_proof_path, 3600); // 1 hour expiry

        if (isMounted) {
          if (!error && data) {
            setProofUrl(data.signedUrl);
          } else {
            setProofUrl(null);
          }
        }
      } catch (err) {
        if (isMounted) setProofUrl(null);
      } finally {
        if (isMounted) setIsGeneratingProofUrl(false);
      }
    }

    loadPrivateProof();
    return () => {
      isMounted = false;
    };
  }, [selectedClaim]);

  // Re-verify claim state is matching expected state to avoid race conditions
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

  // Start Review (PENDING -> UNDER_REVIEW)
  const handleStartReview = async () => {
    if (!selectedClaim || !user || !profile) return;

    setIsStatusTransitioning(true);
    try {
      // 1. Concurrency double check
      const currentClaim = await checkCurrentClaimState(selectedClaim.id);
      if (!currentClaim || currentClaim.status.toUpperCase() !== 'PENDING') {
        showToast({
          type: 'error',
          title: 'Review Collision',
          message: 'This claim status has changed or was modified by another administrator.',
        });
        setIsDetailsOpen(false);
        setSelectedItem(null);
        fetchClaims();
        return;
      }

      // 2. Perform DB update
      const { error } = await supabase
        .from('claims')
        .update({
          status: 'under_review',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedClaim.id);

      if (error) {
        showToast({
          type: 'error',
          title: 'Error Starting Review',
          message: error.message,
        });
        return;
      }

      // 3. Notify Claimant
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedClaim.claimant_id,
          college_id: selectedClaim.college_id,
          title: 'Your claim is now under review.',
          message: `Your ownership claim for "${selectedClaim.items?.item_name || 'your lost item'}" is now being reviewed by your campus administrator.`,
          type: `CLAIM_REVIEW_STARTED:${selectedClaim.item_id}`,
          read: false
        });

      // 4. Log Activity
      await supabase
        .from('activity_logs')
        .insert({
          actor_id: user.id,
          college_id: selectedClaim.college_id,
          action: 'CLAIM_REVIEW_STARTED',
          entity_type: 'CLAIM',
          entity_id: selectedClaim.id,
          metadata: { 
            item_name: selectedClaim.items?.item_name,
            claimant_name: selectedClaim.profiles?.full_name,
            reviewer_email: profile.email
          }
        });

      showToast({
        type: 'success',
        title: 'Review Started',
        message: 'This claim is now marked as UNDER REVIEW.',
      });

      // Refresh data
      fetchClaims();
      // Keep details modal open, but update selected claim local state
      setSelectedClaim(prev => prev ? { ...prev, status: 'UNDER_REVIEW' } : null);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'System Error',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  // Approve Claim (UNDER_REVIEW -> APPROVED)
  const handleApproveClaim = async () => {
    if (!selectedClaim || !user || !profile) return;

    setIsStatusTransitioning(true);
    try {
      // 1. Concurrency double check
      const currentClaim = await checkCurrentClaimState(selectedClaim.id);
      if (!currentClaim || currentClaim.status.toUpperCase() !== 'UNDER_REVIEW') {
        showToast({
          type: 'error',
          title: 'Review Collision',
          message: 'Claim status is no longer under review or has been updated.',
        });
        setIsApproveOpen(false);
        setIsDetailsOpen(false);
        setSelectedItem(null);
        fetchClaims();
        return;
      }

      const timestamp = new Date().toISOString();

      // 2. Perform DB update for claims
      const { error } = await supabase
        .from('claims')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: timestamp
        })
        .eq('id', selectedClaim.id);

      if (error) {
        showToast({
          type: 'error',
          title: 'Approval Failed',
          message: error.message,
        });
        return;
      }

      // 3. Notify Claimant
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedClaim.claimant_id,
          college_id: selectedClaim.college_id,
          title: 'Your claim was approved.',
          message: `Your ownership claim for "${selectedClaim.items?.item_name || 'your item'}" has been approved. The item is ready for the next handover step.`,
          type: `CLAIM_APPROVED:${selectedClaim.item_id}`,
          read: false
        });

      // 4. Log Activity
      await supabase
        .from('activity_logs')
        .insert({
          actor_id: user.id,
          college_id: selectedClaim.college_id,
          action: 'CLAIM_APPROVED',
          entity_type: 'CLAIM',
          entity_id: selectedClaim.id,
          metadata: { 
            item_name: selectedClaim.items?.item_name,
            claimant_name: selectedClaim.profiles?.full_name,
            reviewer_email: profile.email
          }
        });

      showToast({
        type: 'success',
        title: 'Claim Approved',
        message: `Claim from ${selectedClaim.profiles?.full_name} has been approved.`,
      });

      setIsApproveOpen(false);
      setIsDetailsOpen(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'System Error',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  // Reject Claim (UNDER_REVIEW -> REJECTED)
  const handleRejectClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !user || !profile) return;

    setIsStatusTransitioning(true);
    try {
      // 1. Concurrency double check
      const currentClaim = await checkCurrentClaimState(selectedClaim.id);
      if (!currentClaim || currentClaim.status.toUpperCase() !== 'UNDER_REVIEW') {
        showToast({
          type: 'error',
          title: 'Review Collision',
          message: 'Claim status is no longer under review or has been updated.',
        });
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        setSelectedClaim(null);
        fetchClaims();
        return;
      }

      const timestamp = new Date().toISOString();

      // 2. Perform DB update
      const { error } = await supabase
        .from('claims')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: timestamp,
          rejection_reason: rejectionReason.trim() || null
        })
        .eq('id', selectedClaim.id);

      if (error) {
        showToast({
          type: 'error',
          title: 'Rejection Failed',
          message: error.message,
        });
        return;
      }

      // 3. Notify Claimant
      const reasonText = rejectionReason.trim() 
        ? ` Reason: "${rejectionReason.trim()}".` 
        : ' Verification credentials could not be validated.';
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedClaim.claimant_id,
          college_id: selectedClaim.college_id,
          title: 'Your claim was rejected.',
          message: `Your ownership claim for "${selectedClaim.items?.item_name || 'your lost item'}" was rejected.${reasonText}`,
          type: `CLAIM_REJECTED:${selectedClaim.item_id}`,
          read: false
        });

      // 4. Log Activity
      await supabase
        .from('activity_logs')
        .insert({
          actor_id: user.id,
          college_id: selectedClaim.college_id,
          action: 'CLAIM_REJECTED',
          entity_type: 'CLAIM',
          entity_id: selectedClaim.id,
          metadata: { 
            item_name: selectedClaim.items?.item_name,
            claimant_name: selectedClaim.profiles?.full_name,
            rejection_reason: rejectionReason.trim() || undefined,
            reviewer_email: profile.email
          }
        });

      showToast({
        type: 'success',
        title: 'Claim Rejected',
        message: `Claim from ${selectedClaim.profiles?.full_name} has been rejected.`,
      });

      setIsRejectOpen(false);
      setRejectionReason('');
      setIsDetailsOpen(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'System Error',
        message: err.message,
      });
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  // Move approved claim to Handover (APPROVED -> HANDOVER)
  const handleMoveToHandover = async () => {
    if (!selectedClaim || !session?.access_token) return;

    setIsStatusTransitioning(true);
    try {
      const response = await fetch('/api/claim/handover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ claimId: selectedClaim.id })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to move claim to handover.');
      }

      showToast({
        type: 'success',
        title: 'Claim in Handover',
        message: 'The claim status has been updated to handover, and the item status has been set to handover.',
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

  // Confirm item returned & complete handover (HANDOVER -> COMPLETED)
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !session?.access_token) return;

    setIsStatusTransitioning(true);
    try {
      const response = await fetch('/api/claim/confirm-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          claimId: selectedClaim.id,
          handoverNotes: handoverNotes.trim() || undefined
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to confirm return.');
      }

      showToast({
        type: 'success',
        title: 'Return Confirmed',
        message: 'Item returned successfully. Confirmation emails are being processed.',
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
      const matchesClaimant = claimantName.toLowerCase().includes(q) || claimantEmail.toLowerCase().includes(q);
      if (!matchesItem && !matchesId && !matchesClaimant) return false;
    }

    return true;
  });

  const setSelectedItem = (val: any) => {};

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Page Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Claims Verification & Handover</h1>
          <p className="text-xs text-slate-500 mt-1">
            Verify student ownership proof, authorize item handovers, and coordinate safe property return
          </p>
        </div>

        {/* Filters Tab Panel */}
        <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/85 bg-slate-100/70 p-1.5 shrink-0">
          {(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'HANDOVER', 'REJECTED', 'COMPLETED'] as const).map((tab) => {
            const count = claims.filter((c) => c.status === tab).length;
            const tabLabel = tab.replace(/_/g, ' ');

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'PENDING' && <FileText className="w-3.5 h-3.5 text-amber-500" />}
                {tab === 'UNDER_REVIEW' && <Clock className="w-3.5 h-3.5 text-indigo-500" />}
                {tab === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                {tab === 'HANDOVER' && <PlayCircle className="w-3.5 h-3.5 text-blue-500" />}
                {tab === 'REJECTED' && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                {tab === 'COMPLETED' && <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />}
                <span className="capitalize">{tabLabel.toLowerCase()} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Category Filter Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Input
            placeholder="Search claims by item name, claim ID ref, or student claimant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="w-full sm:w-auto">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              ...CATEGORIES.map(c => ({ value: c, label: c.replace(/_/g, ' ') }))
            ]}
          />
        </div>
      </div>

      {isFetching ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium">Loading claims dossiers...</span>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs animate-fade-in">
          {filteredClaims.length === 0 ? (
            <EmptyState
              title={`No ${activeTab.replace(/_/g, ' ').toLowerCase()} claims`}
              description={`There are currently no ownership claims matching the ${activeTab.toLowerCase()} verification queue.`}
              icon={<CheckSquare className="w-8 h-8 text-slate-400" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-3 px-3">Item Name</th>
                    <th className="pb-3 px-3">Claimant</th>
                    <th className="pb-3 px-3">Date Submitted</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {claim.items?.item_name || 'Missing Item Info'}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800">
                        {claim.profiles?.full_name || 'Anonymous Student'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={claim.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedClaim(claim);
                            setIsDetailsOpen(true);
                          }}
                        >
                          Review Dossier
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Claim Review Details Modal */}
      {selectedClaim && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedClaim(null);
          }}
          title="Review Claims Dossier"
          description="Separate comparison between foundational item details and student ownership responses."
          maxWidth="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto pr-1">
            
            {/* Section 1: Item Details */}
            <div className="space-y-4 border-r border-slate-100 pr-0 md:pr-4">
              <div className="flex items-center gap-2 border-b border-indigo-50/80 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block shrink-0" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Item Details (Public Entry)</h4>
              </div>

              {selectedClaim.items?.image_path && (
                <div className="aspect-video rounded-xl bg-slate-50 border border-slate-150 overflow-hidden relative">
                  <img
                    src={selectedClaim.items.image_path}
                    alt={selectedClaim.items.item_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 left-2">
                    <StatusBadge status={selectedClaim.items.type} />
                  </div>
                </div>
              )}

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 block">Item Name:</span>
                  <span className="font-semibold text-slate-800">{selectedClaim.items?.item_name}</span>
                </div>

                <div>
                  <span className="text-slate-400 block">Category:</span>
                  <span className="font-medium text-slate-700 capitalize">{selectedClaim.items?.category.replace(/_/g, ' ')}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block">Found Date:</span>
                    <span className="font-medium text-slate-700">{selectedClaim.items?.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Location Found:</span>
                    <span className="font-medium text-slate-700">{selectedClaim.items?.location}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block">Item Description:</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                    {selectedClaim.items?.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Claim Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-indigo-50/80 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 block shrink-0" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Claim Details (Private Submissions)</h4>
              </div>

              <div className="space-y-3 text-xs">
                {/* Claimant Identity */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                  <span className="font-bold text-slate-800 block">Claimant Student:</span>
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <strong>{selectedClaim.profiles?.full_name}</strong>
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedClaim.profiles?.email}</span>
                  </p>
                </div>

                {/* Claim Date & Location Answers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block">Claimant Lost Date:</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {selectedClaim.lost_date || 'Not Provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Claimant Lost Location:</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedClaim.lost_location || 'Not Provided'}
                    </span>
                  </div>
                </div>

                {/* Claim Explanation */}
                <div>
                  <span className="text-slate-400 block mb-0.5">Explanation of Ownership:</span>
                  <p className="text-[11px] text-slate-700 bg-emerald-50/20 border border-emerald-100 p-2.5 rounded-xl leading-relaxed">
                    {selectedClaim.claim_explanation}
                  </p>
                </div>

                {/* Unique Identifiers */}
                <div>
                  <span className="text-slate-400 block mb-0.5">Unique Markings / Details:</span>
                  <p className="text-[11px] text-slate-700 bg-emerald-50/20 border border-emerald-100 p-2.5 rounded-xl leading-relaxed font-mono">
                    {selectedClaim.identifying_details || 'No specific identifier reported.'}
                  </p>
                </div>

                {/* Contact information answers */}
                {selectedClaim.contact_information && (
                  <div>
                    <span className="text-slate-400 block">Provided Contact Info:</span>
                    <span className="font-medium text-slate-800">{selectedClaim.contact_information}</span>
                  </div>
                )}

                {/* Additional Message */}
                {selectedClaim.additional_message && (
                  <div>
                    <span className="text-slate-400 block">Additional Message:</span>
                    <p className="italic text-slate-600">"{selectedClaim.additional_message}"</p>
                  </div>
                )}

                {/* Private Storage Ownership Proof View */}
                <div>
                  <span className="text-slate-400 block mb-1">Ownership Proof Evidence:</span>
                  {selectedClaim.ownership_proof_path ? (
                    isGeneratingProofUrl ? (
                      <div className="flex items-center gap-2 text-slate-400 text-[11px] py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating secure verification link...</span>
                      </div>
                    ) : proofUrl ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        {selectedClaim.ownership_proof_path.toLowerCase().endsWith('.pdf') ? (
                          <div className="p-3 text-center">
                            <a
                              href={proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 hover:underline font-bold"
                            >
                              Open Secure PDF Document
                            </a>
                          </div>
                        ) : (
                          <a href={proofUrl} target="_blank" rel="noreferrer">
                            <img
                              src={proofUrl}
                              alt="Claimant Proof"
                              className="w-full max-h-40 object-contain hover:opacity-90 transition"
                            />
                          </a>
                        )}
                        <div className="p-2 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-500 flex gap-1 items-center">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Strictly Confidential Signed Link</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 text-center border border-dashed border-slate-200">
                        <span>Failed to fetch proof. Secure link expired or invalid.</span>
                      </div>
                    )
                  ) : (
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 text-center border border-dashed border-slate-200">
                      <span>No photograph/evidence uploaded.</span>
                    </div>
                  )}
                </div>

                {/* Handover Info */}
                {selectedClaim.handover_at && (
                  <div className="p-2.5 bg-blue-50/55 border border-blue-100/70 text-blue-900 rounded-xl space-y-1">
                    <strong className="text-[11px] text-blue-850 flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
                      Handover Preparation Details:
                    </strong>
                    <p className="text-[10px] text-blue-750">
                      Moved to Handover: {new Date(selectedClaim.handover_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Case Completed Info */}
                {selectedClaim.status === 'COMPLETED' && selectedClaim.completed_at && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl space-y-1">
                    <strong className="text-[11px] text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                      Case Completed:
                    </strong>
                    <p className="text-[10px] text-slate-650">
                      Handed Over On: {new Date(selectedClaim.completed_at).toLocaleString()}
                    </p>
                    {selectedClaim.handover_notes && (
                      <p className="text-[11px] text-slate-700 italic bg-white p-2 rounded border border-slate-150 mt-1">
                        "{selectedClaim.handover_notes}"
                      </p>
                    )}
                  </div>
                )}

                {/* Rejection Log */}
                {selectedClaim.status === 'REJECTED' && selectedClaim.rejection_reason && (
                  <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl">
                    <strong>Rejection Reason:</strong> {selectedClaim.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDetailsOpen(false);
                setSelectedClaim(null);
              }}
            >
              Close
            </Button>

            <div className="flex gap-2">
              {/* Start Review (Pending -> Under Review) */}
              {selectedClaim.status === 'PENDING' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStartReview}
                  isLoading={isStatusTransitioning}
                  leftIcon={<PlayCircle className="w-4 h-4" />}
                >
                  Start Review
                </Button>
              )}

              {/* Approve & Reject (Under Review only) */}
              {selectedClaim.status === 'UNDER_REVIEW' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsRejectOpen(true)}
                  >
                    Reject Claim
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsApproveOpen(true)}
                  >
                    Approve Claim
                  </Button>
                </>
              )}

              {/* Move to Handover (Approved claims only) */}
              {selectedClaim.status === 'APPROVED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleMoveToHandover}
                  isLoading={isStatusTransitioning}
                  leftIcon={<PlayCircle className="w-4 h-4" />}
                >
                  Move to Handover
                </Button>
              )}

              {/* Confirm Return (Handover claims only) */}
              {selectedClaim.status === 'HANDOVER' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsReturnOpen(true)}
                  isLoading={isStatusTransitioning}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                >
                  Confirm Return
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation: Approve Claim */}
      <ConfirmationDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApproveClaim}
        title="Approve this claim?"
        message={`Are you sure you want to approve "${selectedClaim?.profiles?.full_name || 'this'}" ownership claim? This authorizes physical coordination steps but keeps the item listed as published until final handover completion.`}
        confirmLabel="Approve Claim"
        isLoading={isStatusTransitioning}
      />

      {/* Rejection Reason Modal */}
      {selectedClaim && (
        <Modal
          isOpen={isRejectOpen}
          onClose={() => {
            setIsRejectOpen(false);
            setRejectionReason('');
          }}
          title="Reject Claim?"
          description={`Provide a clear explanation describing why this claim is being declined. The student claimant will see this note.`}
          maxWidth="sm"
        >
          <form onSubmit={handleRejectClaim} className="space-y-4">
            <Textarea
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Claimant lost device has a different color / distinct serial code discrepancy..."
              rows={3}
              requiredIndicator
            />
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
              <Button
                type="submit"
                variant="danger"
                size="sm"
                isLoading={isStatusTransitioning}
              >
                Confirm Rejection
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Confirmation Modal with optional Notes */}
      {selectedClaim && (
        <Modal
          isOpen={isReturnOpen}
          onClose={() => {
            setIsReturnOpen(false);
            setHandoverNotes('');
          }}
          title="Confirm Physical Handover & Return"
          description={`Confirm that the physical item "${selectedClaim.items?.item_name || 'this item'}" has been successfully handed over to the verified owner "${selectedClaim.profiles?.full_name}". This will close the case permanently.`}
          maxWidth="sm"
        >
          <form onSubmit={handleConfirmReturn} className="space-y-4">
            <Textarea
              label="Physical Handover & Verification Notes (Optional)"
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Student presented matching student ID and unlocked the phone to verify ownership."
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isStatusTransitioning}
              >
                Confirm Return & Close Case
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
