import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Tag, 
  ShieldCheck, 
  ImageIcon, 
  Send,
  Building2,
  Clock,
  Loader2,
  Lock
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { Input } from '../../components/ui/Input';
import { FileUpload } from '../../components/ui/FileUpload';
import { Item } from '../../types';

export const ItemDetailPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimExplanation, setClaimExplanation] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // New claim fields state
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
              title: 'Item Not Found',
              message: 'This item report does not exist or you do not have permission to access it.',
            });
            navigate('/student/browse');
          } else if (data) {
            setItem({
              ...data,
              type: (data.type || 'LOST').toUpperCase(),
              status: (data.status || 'PENDING').toUpperCase(),
            } as Item);
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
  }, [itemId, navigate]);

  const uploadProof = async (file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File exceeds the 5MB size limit.');
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only image files and PDF are allowed as ownership proof.');
    }

    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `proofs/${user?.id}/${uniqueName}`;

    const { data, error } = await supabase.storage
      .from('claim-proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    return filePath; // Store the exact path in PostgreSQL
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !user) return;

    // Check if the college is deactivated
    const { data: colData } = await supabase
      .from('colleges')
      .select('*')
      .eq('id', item.college_id)
      .single();

    if (colData?.domain?.startsWith('[DEACTIVATED]')) {
      showToast({
        type: 'error',
        title: 'College Inactive',
        message: 'This college directory has been deactivated. Claim submissions are disabled.',
      });
      return;
    }

    // Security check: cannot claim own found report
    if (item.user_id === user.id) {
      showToast({
        type: 'error',
        title: 'Unauthorized Action',
        message: 'You cannot submit an ownership claim for an item you reported.',
      });
      return;
    }

    // Security check: must be a FOUND item
    if (item.type !== 'FOUND') {
      showToast({
        type: 'error',
        title: 'Invalid Action',
        message: 'You can only claim items reported as FOUND.',
      });
      return;
    }

    // Security check: must be PUBLISHED
    if (item.status !== 'PUBLISHED' && item.status !== 'APPROVED') {
      showToast({
        type: 'error',
        title: 'Invalid Action',
        message: 'This item is not open for claims.',
      });
      return;
    }

    if (!claimExplanation.trim()) {
      showToast({
        type: 'error',
        title: 'Explanation Required',
        message: 'Please provide details explaining why this item belongs to you.',
      });
      return;
    }

    setIsSubmittingClaim(true);

    try {
      if (isSupabaseConfigured()) {
        // 1. Prevent duplicate active claims
        const { data: existingClaims, error: checkError } = await supabase
          .from('claims')
          .select('id')
          .eq('item_id', item.id)
          .eq('claimant_id', user.id)
          .not('status', 'eq', 'rejected');

        if (checkError) {
          throw checkError;
        }

        if (existingClaims && existingClaims.length > 0) {
          showToast({
            type: 'error',
            title: 'Duplicate Claim',
            message: 'You already have an active claim for this item in review.',
          });
          setIsSubmittingClaim(false);
          return;
        }

        // 2. Upload ownership proof if selected
        let proofPath: string | null = null;
        if (proofFile) {
          proofPath = await uploadProof(proofFile);
        }

        // 3. Insert claim
        const { data: claimData, error: insertError } = await supabase
          .from('claims')
          .insert({
            item_id: item.id,
            claimant_id: user.id,
            college_id: item.college_id,
            claim_explanation: claimExplanation.trim(),
            lost_date: lostDate ? lostDate : null,
            lost_location: lostLocation.trim() || null,
            identifying_details: identifyingDetails.trim() || null,
            ownership_proof_path: proofPath,
            contact_information: contactInformation.trim() || null,
            additional_message: additionalMessage.trim() || null,
            status: 'pending'
          })
          .select()
          .single();

        if (insertError) {
          setIsSubmittingClaim(false);
          showToast({
            type: 'error',
            title: 'Claim Submission Failed',
            message: getFriendlyAuthErrorMessage(insertError),
          });
          return;
        }

        // 4. Create Notification for College Admins
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('college_id', item.college_id)
          .eq('role', 'college_admin');

        if (admins && admins.length > 0) {
          const adminNotifications = admins.map(admin => ({
            user_id: admin.id,
            college_id: item.college_id,
            title: 'New claim submitted',
            message: `A student has submitted an ownership claim for "${item.item_name}".`,
            type: `CLAIM_SUBMITTED:${item.id}`,
            read: false
          }));
          await supabase.from('notifications').insert(adminNotifications);
        }

        // 5. Add Activity Log
        await supabase
          .from('activity_logs')
          .insert({
            actor_id: user.id,
            college_id: item.college_id,
            action: 'CLAIM_CREATED',
            entity_type: 'CLAIM',
            entity_id: claimData.id,
            metadata: { item_name: item.item_name, item_id: item.id }
          });
      }

      setIsSubmittingClaim(false);
      setIsClaimModalOpen(false);
      
      // Reset form states
      setClaimExplanation('');
      setLostDate('');
      setLostLocation('');
      setIdentifyingDetails('');
      setContactInformation('');
      setAdditionalMessage('');
      setProofFile(null);

      showToast({
        type: 'success',
        title: 'Claim Submitted Successfully',
        message: 'Your claim has been submitted. The college team will review it according to campus verification procedures. Typical response time: 24–48 hours.',
      });
      navigate('/student/activity');
    } catch (err: any) {
      setIsSubmittingClaim(false);
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'An unexpected error occurred during claim submission.',
      });
    }
  };

  if (isFetching) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-3 text-slate-500 animate-fade-in">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs font-medium">Retrieving item details...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-20 text-center animate-fade-in">
        <h2 className="text-lg font-bold text-slate-900">Item details unavailable</h2>
        <p className="text-xs text-slate-500 mt-1">Please try again or select another item.</p>
        <Button size="sm" className="mt-4" onClick={() => navigate('/student/browse')}>
          Back to Browse
        </Button>
      </div>
    );
  }

  const isOwnItem = item.user_id === user?.id;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/student/browse')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Browse</span>
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Item Image area */}
          <div className="aspect-square md:aspect-auto bg-slate-100 flex flex-col items-center justify-center p-8 border-b md:border-b-0 md:border-r border-slate-100 relative min-h-[300px]">
            {item.image_path ? (
              <img
                src={item.image_path}
                alt={item.item_name}
                referrerPolicy="no-referrer"
                className="w-full h-full max-h-[400px] object-contain rounded-2xl"
              />
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-400 mb-3">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                </div>
                <p className="text-xs font-medium text-slate-500">No Image Provided</p>
                <p className="text-[11px] text-slate-400 text-center max-w-xs mt-1">
                  Public student report recorded without photograph
                </p>
              </>
            )}

            <div className="absolute top-4 left-4 flex gap-2">
              <StatusBadge status={item.type} />
              <StatusBadge status={item.status} />
            </div>
          </div>

          {/* Item Details */}
          <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{item.category.replace(/_/g, ' ')}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400 font-mono">ID: {item.id.substring(0, 8)}...</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {item.item_name}
                </h1>
              </div>

              {/* Attributes list */}
              <div className="space-y-2.5 py-3 border-y border-slate-100 text-xs">
                {item.brand && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Brand / Manufacturer:</span>
                    <span className="font-semibold text-slate-800">{item.brand}</span>
                  </div>
                )}

                {item.color && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Primary Color:</span>
                    <span className="font-semibold text-slate-800">{item.color}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Date Logged:
                  </span>
                  <span className="font-semibold text-slate-800">{item.date}</span>
                </div>

                {item.approximate_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Approximate Time:
                    </span>
                    <span className="font-semibold text-slate-800">{item.approximate_time}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Campus Location:
                  </span>
                  <span className="font-semibold text-slate-800">{item.location}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Public Description
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Claim this item or indicator */}
            <div className="pt-4 border-t border-slate-100">
              {isOwnItem ? (
                <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-center">
                  <p className="text-xs text-indigo-900 font-semibold">Your Reported Item</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    You submitted this report. Review status changes under My Activity.
                  </p>
                </div>
              ) : item.type === 'LOST' ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center">
                  <p className="text-xs text-amber-900 font-semibold">Lost Item Directory Entry</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    This item was reported lost. If you have found it, please contact support or campus administrators.
                  </p>
                </div>
              ) : item.status === 'RETURNED' || item.status === 'COMPLETED' ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                  <p className="text-xs text-emerald-900 font-semibold">Item Returned</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    This item has been successfully verified and returned to its rightful owner.
                  </p>
                </div>
              ) : item.status === 'HANDOVER' ? (
                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center">
                  <p className="text-xs text-blue-900 font-semibold">Handover In Progress</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    This item is currently being physically handed over to its verified claimant.
                  </p>
                </div>
              ) : item.status === 'APPROVED' ? (
                <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-center">
                  <p className="text-xs text-indigo-900 font-semibold">Claim Approved</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    An ownership claim has been approved for this item and physical handover is being prepared.
                  </p>
                </div>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => setIsClaimModalOpen(true)}
                    leftIcon={<ShieldCheck className="w-5 h-5" />}
                  >
                    Claim This Item
                  </Button>
                  <p className="text-[11px] text-slate-400 text-center mt-2">
                    All claims require verification by your authorized College Administrator
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Claim Modal */}
      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title="Submit Ownership Claim"
        description="Provide verification details. College Admins review claims before authorizing handover."
      >
        <form onSubmit={handleClaimSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Textarea
            label="Why is this yours?"
            value={claimExplanation}
            onChange={(e) => setClaimExplanation(e.target.value)}
            placeholder="e.g. I lost my phone yesterday while studying at the library. It has my name on the lock screen."
            rows={3}
            requiredIndicator
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Approximate date you lost it"
              type="date"
              value={lostDate}
              onChange={(e) => setLostDate(e.target.value)}
            />
            <Input
              label="Where did you lose it?"
              type="text"
              value={lostLocation}
              onChange={(e) => setLostLocation(e.target.value)}
              placeholder="e.g. Science Library, 2nd floor"
            />
          </div>

          <Textarea
            label="What makes it unique?"
            value={identifyingDetails}
            onChange={(e) => setIdentifyingDetails(e.target.value)}
            placeholder="Describe unique marks, specific stickers, scratches, case design, or wallpaper/contents..."
            rows={2}
          />

          <Input
            label="Contact information"
            type="text"
            value={contactInformation}
            onChange={(e) => setContactInformation(e.target.value)}
            placeholder="e.g. Phone number, alternative email, or social handle"
          />

          <Textarea
            label="Additional message (Optional)"
            value={additionalMessage}
            onChange={(e) => setAdditionalMessage(e.target.value)}
            placeholder="Any other details you want to share with the campus admin..."
            rows={2}
          />

          <FileUpload
            label="Proof of Ownership (Optional)"
            value={proofFile}
            onChange={(file) => setProofFile(file)}
            helperText="Receipt, photo with the item, or warranty card (PNG, JPG, WEBP, PDF, max 5MB)"
          />

          {/* ISS-03: Turnaround Guidance Box */}
          <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-indigo-950">Campus Review Guidance</p>
              <p className="mt-0.5 text-indigo-800 leading-relaxed">
                Your claim will be reviewed by the college team according to campus verification procedures. Typical response time: 24–48 hours.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              <strong>Security Notice:</strong> False claims are reported to campus disciplinary authorities. Verification decisions are made strictly by College Administrators.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
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
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Claim
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
