import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage, getStoragePath, safeInsert } from '../../lib/supabase';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  ShieldCheck,
  ImageIcon,
  Send,
  Clock,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FileUpload } from '../../components/ui/FileUpload';
import { LoadingState } from '../../components/ui/LoadingState';
import { Item } from '../../types';

export const ItemDetailPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const { showToast } = useToast();
  const { user, session } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  const [myActiveLostReports, setMyActiveLostReports] = useState<Item[]>([]);
  const [selectedLostReportId, setSelectedLostReportId] = useState<string>('');
  const [existingClaimStatus, setExistingClaimStatus] = useState<string | null>(null);
  const [isLinkedClaimModalOpen, setIsLinkedClaimModalOpen] = useState(false);
  const [linkedAdditionalNote, setLinkedAdditionalNote] = useState('');
  const [isSubmittingLinkedClaim, setIsSubmittingLinkedClaim] = useState(false);

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimExplanation, setClaimExplanation] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  const [lostDate, setLostDate] = useState('');
  const [lostLocation, setLostLocation] = useState('');
  const [identifyingDetails, setIdentifyingDetails] = useState('');
  const [contactInformation, setContactInformation] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');

  const itemId = params.id;

  useEffect(() => {
    let isMounted = true;

    async function loadItem() {
      if (!itemId || !isSupabaseConfigured()) {
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('id', itemId)
          .single();

        if (isMounted) {
          if (error) {
            console.error('Error fetching item details:', error);
            showToast({
              type: 'error',
              title: 'Item not found',
              message: 'Unable to open this listing.',
            });
            navigate('/student/browse');
          } else if (data) {
            const normalizedItem = {
              ...data,
              type: (data.type || 'FOUND').toUpperCase(),
              status: (data.status || 'PENDING').toUpperCase(),
            } as Item;
            setItem(normalizedItem);

            if (user && normalizedItem.type === 'FOUND' && normalizedItem.user_id !== user.id) {
              const [{ data: existingClaims }, { data: lostReports }] = await Promise.all([
                supabase
                  .from('claims')
                  .select('id, status')
                  .eq('item_id', normalizedItem.id)
                  .eq('claimant_id', user.id)
                  .neq('status', 'rejected')
                  .limit(1),
                supabase
                  .from('items')
                  .select('*')
                  .eq('user_id', user.id)
                  .in('type', ['lost', 'LOST'])
                  .not('status', 'in', '("rejected","returned","closed","REJECTED","RETURNED","CLOSED")')
                  .order('created_at', { ascending: false }),
              ]);

              if (isMounted) {
                if (existingClaims && existingClaims.length > 0) {
                  setExistingClaimStatus((existingClaims[0].status || 'PENDING').toUpperCase());
                } else {
                  setExistingClaimStatus(null);
                }

                if (lostReports && lostReports.length > 0) {
                  const formattedLost = lostReports.map((r: any) => ({
                    ...r,
                    type: 'LOST',
                    status: (r.status || 'PENDING').toUpperCase(),
                  })) as Item[];
                  setMyActiveLostReports(formattedLost);
                  const preferred =
                    formattedLost.find((l) => l.category === normalizedItem.category) ||
                    formattedLost[0];
                  setSelectedLostReportId(preferred.id);
                } else {
                  setMyActiveLostReports([]);
                  setSelectedLostReportId('');
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching item:', err);
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadItem();

    return () => {
      isMounted = false;
    };
  }, [itemId, navigate, user]);

  const handleLinkedClaimFromLostReport = async () => {
    if (!item || !selectedLostReportId || !session?.access_token) return;

    setIsSubmittingLinkedClaim(true);
    try {
      const res = await fetch('/api/student/claims/from-lost-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          foundItemId: item.id,
          lostItemId: selectedLostReportId,
          additionalNote: linkedAdditionalNote.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit claim.');
      }

      setExistingClaimStatus('PENDING');
      setIsLinkedClaimModalOpen(false);
      setLinkedAdditionalNote('');
      showToast({
        type: 'success',
        title: 'Claim submitted',
        message: 'Linked to your Lost Report for admin verification.',
      });
      navigate('/student/claims');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission failed',
        message: err.message || 'Could not submit claim.',
      });
    } finally {
      setIsSubmittingLinkedClaim(false);
    }
  };

  const uploadProof = async (file: File, collegeId: string, userId: string): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File exceeds the 5MB limit.');
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only PNG, JPG, WEBP, and PDF files are allowed.');
    }

    const filePath = getStoragePath(collegeId, userId, file.name);

    const { error } = await supabase.storage
      .from('claim-proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    return filePath;
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !user) return;

    if (item.user_id === user.id) {
      showToast({
        type: 'error',
        title: 'Not allowed',
        message: 'You cannot claim an item you reported.',
      });
      return;
    }

    if (item.type !== 'FOUND') {
      showToast({
        type: 'error',
        title: 'Not allowed',
        message: 'Only Found items can be claimed.',
      });
      return;
    }

    if (item.status !== 'PUBLISHED' && item.status !== 'APPROVED') {
      showToast({
        type: 'error',
        title: 'Unavailable',
        message: 'This item is not open for claims.',
      });
      return;
    }

    if (!claimExplanation.trim()) {
      showToast({
        type: 'error',
        title: 'Required',
        message: 'Explain why this item belongs to you.',
      });
      return;
    }

    setIsSubmittingClaim(true);

    try {
      if (isSupabaseConfigured()) {
        const { data: existingClaims, error: checkError } = await supabase
          .from('claims')
          .select('id')
          .eq('item_id', item.id)
          .eq('claimant_id', user.id)
          .not('status', 'eq', 'rejected');

        if (checkError) throw checkError;

        if (existingClaims && existingClaims.length > 0) {
          showToast({
            type: 'error',
            title: 'Already claimed',
            message: 'You already have an active claim for this item.',
          });
          setIsSubmittingClaim(false);
          return;
        }

        let proofPath: string | null = null;
        if (proofFile) {
          proofPath = await uploadProof(proofFile, item.college_id, user.id);
        }

        const { data: claimData, error: insertError } = await safeInsert<any>(
          'claims',
          {
            item_id: item.id,
            claimant_id: user.id,
            college_id: item.college_id,
            claim_explanation: claimExplanation.trim(),
            lost_date: lostDate || null,
            lost_location: lostLocation.trim() || null,
            identifying_details: identifyingDetails.trim() || null,
            ownership_proof_path: proofPath,
            contact_information: contactInformation.trim() || null,
            additional_message: additionalMessage.trim() || null,
            status: 'pending',
          },
          { select: '*', single: true }
        );

        if (insertError) {
          setIsSubmittingClaim(false);
          showToast({
            type: 'error',
            title: 'Submission failed',
            message: getFriendlyAuthErrorMessage(insertError),
          });
          return;
        }

        try {
          const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('college_id', item.college_id)
            .eq('role', 'college_admin');

          if (admins && admins.length > 0) {
            await supabase.from('notifications').insert(
              admins.map((admin) => ({
                user_id: admin.id,
                college_id: item.college_id,
                title: 'New claim submitted',
                message: `A student submitted an ownership claim for "${item.item_name}".`,
                type: `CLAIM_SUBMITTED:${item.id}`,
                read: false,
              }))
            );
          }
        } catch (notifErr) {
          console.warn('Admin notification insert skipped:', notifErr);
        }

        try {
          await supabase.from('activity_logs').insert({
            actor_id: user.id,
            college_id: item.college_id,
            action: 'CLAIM_CREATED',
            entity_type: 'CLAIM',
            entity_id: claimData.id,
            metadata: { item_name: item.item_name, item_id: item.id },
          });
        } catch (logErr) {
          console.warn('Activity log insert skipped:', logErr);
        }
      }

      setIsSubmittingClaim(false);
      setIsClaimModalOpen(false);
      setClaimExplanation('');
      setLostDate('');
      setLostLocation('');
      setIdentifyingDetails('');
      setContactInformation('');
      setAdditionalMessage('');
      setProofFile(null);

      showToast({
        type: 'success',
        title: 'Claim submitted',
        message: 'Sent to College Admin for verification.',
      });
      navigate('/student/claims');
    } catch (err: any) {
      setIsSubmittingClaim(false);
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Could not submit claim.',
      });
    }
  };

  if (isFetching) {
    return <LoadingState message="Loading item..." />;
  }

  if (!item) {
    return (
      <div className="py-16 text-center space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Item unavailable</h2>
        <Button size="sm" variant="outline" onClick={() => navigate('/student/browse')}>
          Back to Browse
        </Button>
      </div>
    );
  }

  const isOwnItem = item.user_id === user?.id;
  const categoryLabel = (item.category || 'OTHER')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="w-full max-w-4xl space-y-5">
      <button
        type="button"
        onClick={() => navigate('/student/browse')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Browse</span>
      </button>

      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image */}
          <div className="bg-slate-50 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-100 relative min-h-[280px]">
            {item.image_path ? (
              <img
                src={item.image_path}
                alt={item.item_name}
                referrerPolicy="no-referrer"
                className="w-full h-full max-h-[380px] object-contain rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-300">
                <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                <span className="text-xs text-slate-400 mt-2">No photo</span>
              </div>
            )}

            <div className="absolute top-3.5 left-3.5 flex gap-1.5">
              <StatusBadge status={item.type} size="sm" />
              <StatusBadge status={item.status} size="sm" />
            </div>
          </div>

          {/* Details & Action */}
          <div className="p-6 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-indigo-600">{categoryLabel}</p>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">{item.item_name}</h1>
              </div>

              <dl className="divide-y divide-slate-100 border-y border-slate-100 text-xs">
                {item.brand && (
                  <div className="py-2 flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Brand</dt>
                    <dd className="font-medium text-slate-900">{item.brand}</dd>
                  </div>
                )}
                {item.color && (
                  <div className="py-2 flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Color</dt>
                    <dd className="font-medium text-slate-900">{item.color}</dd>
                  </div>
                )}
                <div className="py-2 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Location</span>
                  </dt>
                  <dd className="font-medium text-slate-900 text-right">{item.location}</dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date</span>
                  </dt>
                  <dd className="font-medium text-slate-900 tabular-nums">{item.date}</dd>
                </div>
                {item.approximate_time && (
                  <div className="py-2 flex items-center justify-between gap-4">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Time</span>
                    </dt>
                    <dd className="font-medium text-slate-900 tabular-nums">{item.approximate_time}</dd>
                  </div>
                )}
              </dl>

              {item.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              )}
            </div>

            {/* Action Area */}
            <div className="pt-4 border-t border-slate-100">
              {isOwnItem ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  You submitted this report.{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/student/reports')}
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    View My Reports
                  </button>
                </p>
              ) : item.type === 'LOST' ? (
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => navigate('/student/report-found')}
                >
                  Found this item? Report Found
                </Button>
              ) : item.status === 'PUBLISHED' || item.status === 'APPROVED' ? (
                existingClaimStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        Claim submitted
                      </span>
                      <StatusBadge status={existingClaimStatus} size="sm" />
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={() => navigate('/student/claims')}
                    >
                      Track My Claim
                    </Button>
                  </div>
                ) : myActiveLostReports.length > 0 ? (
                  <div className="space-y-3">
                    {myActiveLostReports.length > 1 && (
                      <Select
                        label="Link Lost Report"
                        value={selectedLostReportId}
                        onChange={(e) => setSelectedLostReportId(e.target.value)}
                        options={myActiveLostReports.map((lr) => ({
                          value: lr.id,
                          label: `${lr.item_name} (${lr.date})`,
                        }))}
                      />
                    )}

                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={() => setIsLinkedClaimModalOpen(true)}
                      leftIcon={<Check className="w-4 h-4" />}
                    >
                      This Is My Item
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setIsClaimModalOpen(true)}
                        className="text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        Submit manual claim instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => setIsClaimModalOpen(true)}
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                  >
                    Claim This Item
                  </Button>
                )
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                  <span>Status:</span>
                  <StatusBadge status={item.status} size="sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Standard Claim Modal */}
      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title="Claim Item"
        maxWidth="md"
      >
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <Textarea
            label="Proof of ownership"
            value={claimExplanation}
            onChange={(e) => setClaimExplanation(e.target.value)}
            placeholder="Describe how you know this item is yours..."
            rows={3}
            requiredIndicator
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date lost"
              type="date"
              value={lostDate}
              onChange={(e) => setLostDate(e.target.value)}
            />
            <Input
              label="Where lost"
              value={lostLocation}
              onChange={(e) => setLostLocation(e.target.value)}
              placeholder="e.g. Library 2nd Floor"
            />
          </div>

          <Textarea
            label="Unique marks / details"
            value={identifyingDetails}
            onChange={(e) => setIdentifyingDetails(e.target.value)}
            placeholder="Serial number, stickers, wallpaper, scratches..."
            rows={2}
          />

          <Input
            label="Contact info"
            value={contactInformation}
            onChange={(e) => setContactInformation(e.target.value)}
            placeholder="Phone or email"
          />

          <FileUpload
            label="Supporting file (optional)"
            value={proofFile}
            onChange={(file) => setProofFile(file)}
            helperText="Receipt or photo · PNG, JPG, PDF up to 5MB"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsClaimModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingClaim}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Claim
            </Button>
          </div>
        </form>
      </Modal>

      {/* One-Click Linked Claim Confirmation Modal */}
      {(() => {
        const selectedLost = myActiveLostReports.find((r) => r.id === selectedLostReportId);
        if (!selectedLost) return null;
        return (
          <Modal
            isOpen={isLinkedClaimModalOpen}
            onClose={() => {
              if (!isSubmittingLinkedClaim) {
                setIsLinkedClaimModalOpen(false);
                setLinkedAdditionalNote('');
              }
            }}
            title="Confirm: This Is My Item"
            maxWidth="md"
          >
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-amber-700">Linking Lost Report</span>
                <p className="text-sm font-semibold text-slate-900">{selectedLost.item_name}</p>
                <p className="text-slate-500">
                  {selectedLost.location} · {selectedLost.date}
                </p>
              </div>

              <Textarea
                label="Note for Admin (optional)"
                value={linkedAdditionalNote}
                onChange={(e) => setLinkedAdditionalNote(e.target.value)}
                placeholder="Any extra identifying detail..."
                rows={2}
              />

              <p className="text-xs text-slate-500">
                College Admin will verify ownership before authorizing handover.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmittingLinkedClaim}
                  onClick={() => {
                    setIsLinkedClaimModalOpen(false);
                    setLinkedAdditionalNote('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmittingLinkedClaim}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={handleLinkedClaimFromLostReport}
                >
                  Submit Claim
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
