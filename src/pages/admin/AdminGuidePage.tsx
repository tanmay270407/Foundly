import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  FileText, 
  CheckSquare, 
  Handshake, 
  QrCode, 
  Bell, 
  BarChart3, 
  Building2, 
  Save, 
  CheckCircle2,
  Info,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { getCollegeLaunchData, saveCollegeLaunchData } from '../../lib/collegeLaunch';
import { 
  getCollegePilotData, 
  saveCollegePilotData, 
  submitPilotFeedback, 
  AdminPilotChecklistItem, 
  DEFAULT_ADMIN_PILOT_CHECKLIST 
} from '../../lib/collegePilot';

export const AdminGuidePage: React.FC = () => {
  const { profile, user } = useAuth();
  const { showToast } = useToast();

  const [contactInfo, setContactInfo] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Pilot Checklist
  const [pilotChecklist, setPilotChecklist] = useState<AdminPilotChecklistItem[]>(DEFAULT_ADMIN_PILOT_CHECKLIST);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Feedback form
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (profile?.college_id) {
      getCollegeLaunchData(profile.college_id).then((data) => {
        if (data.operationalInfo?.officeLocation) {
          setContactInfo(data.operationalInfo.officeLocation);
        }
      });

      getCollegePilotData(profile.college_id).then((pilotData) => {
        if (pilotData.adminChecklist) {
          setPilotChecklist(pilotData.adminChecklist);
        }
      });
    }
  }, [profile?.college_id]);

  const handleToggleChecklist = (id: string) => {
    setPilotChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleSaveChecklist = async () => {
    if (!profile?.college_id || !user?.id) return;
    setIsSavingChecklist(true);
    try {
      const pilotData = await getCollegePilotData(profile.college_id);
      const ok = await saveCollegePilotData(
        profile.college_id,
        user.id,
        pilotData.pilotState,
        pilotData.goals,
        pilotChecklist,
        profile.full_name || user.email
      );

      if (ok) {
        showToast({
          type: 'success',
          title: 'Pilot Checklist Saved 🎉',
          message: 'Your operational workflow readiness was persisted.',
        });
      } else {
        throw new Error('Save failed');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message,
      });
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.college_id || !user?.id || !feedbackText.trim()) return;

    setIsSubmittingFeedback(true);
    try {
      const ok = await submitPilotFeedback(
        profile.college_id,
        user.id,
        'college_admin',
        feedbackText.trim(),
        feedbackRating,
        profile.full_name || profile.email || user.email
      );

      if (ok) {
        showToast({
          type: 'success',
          title: 'Feedback Submitted 🎉',
          message: 'Thank you! Your private operational feedback was sent to Foundly Operations.',
        });
        setFeedbackText('');
      } else {
        throw new Error('Submission failed');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.college_id || !user?.id) return;

    setIsSavingContact(true);
    try {
      const launchData = await getCollegeLaunchData(profile.college_id);
      const result = await saveCollegeLaunchData(
        profile.college_id,
        user.id,
        launchData.checklist,
        launchData.launchStatus,
        {
          ...launchData.operationalInfo,
          officeLocation: contactInfo.trim()
        }
      );

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Location Contact Saved 🎉',
          message: 'Official campus Lost & Found contact instructions updated for students.',
        });
      } else {
        throw new Error('Save failed');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update contact information.',
      });
    } finally {
      setIsSavingContact(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in" id="admin-guide-root">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>College Administrator Operations Manual</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Administrator Operational Guide & Instructions
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Standard operational protocols for moderating reports, verifying claims, handling physical returns, and configuring campus contact information.
        </p>
      </div>

      {/* Admin Pilot Readiness Checklist */}
      <div className="p-6 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                College Administrator Pilot Readiness Checklist
              </h2>
              <p className="text-xs text-slate-500">
                Confirm your understanding of core workflows prior to campus pilot activation.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveChecklist}
            isLoading={isSavingChecklist}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Readiness
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {pilotChecklist.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-slate-100 transition-colors"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => handleToggleChecklist(item.id)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span className={`font-medium ${item.completed ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Operational Campus Lost & Found Contact Configuration */}
      <div className="p-6 rounded-3xl border border-indigo-100 bg-indigo-50/50 space-y-4">
        <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
              Official Campus Lost & Found Location & Contact Info
            </h2>
            <p className="text-xs text-indigo-800/80">
              This information is displayed to students when submitting claims and viewing help instructions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveContact} className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-1 w-full">
            <Input
              label="Campus Lost & Found Office & Operating Hours"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="e.g. Visit Campus Security Desk (Building A, Room 102) Mon-Fri 9AM-5PM."
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            isLoading={isSavingContact}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Contact
          </Button>
        </form>
      </div>

      {/* Operational Workflow Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Step 1: Review Reports */}
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>1. Report Moderation</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">Reviewing Submitted Reports</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Navigate to <strong>"Review Reports"</strong>. Inspect lost/found submissions for completeness, appropriate category selection, and photo clarity before approval or publication.
          </p>
        </div>

        {/* Step 2: Approve / Reject */}
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>2. Approval Protocol</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">Approving or Rejecting Items</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Approve legitimate reports to make them searchable in the campus catalog. If rejecting duplicate or invalid submissions, provide a clear, helpful reason to the student.
          </p>
        </div>

        {/* Step 3: Review Claims */}
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
            <CheckSquare className="w-4 h-4" />
            <span>3. Claim Verification</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">Reviewing Ownership Claims</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Open <strong>"Verify Claims"</strong>. Carefully compare the claimant's private explanation, serial numbers, or purchase receipt against private item details.
          </p>
        </div>

        {/* Step 4: Schedule Handover */}
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
            <Handshake className="w-4 h-4" />
            <span>4. Handover Scheduling</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">Scheduling Item Handover</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Upon verifying claim authenticity, click <strong>"Approve & Schedule Handover"</strong>. Specify office pickup date, time, and instructions. Automated notifications are sent via Resend.
          </p>
        </div>

        {/* Step 5: Storage Tags & QR */}
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
            <QrCode className="w-4 h-4" />
            <span>5. Storage Tag Management</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">QR & Storage Tagging</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Print or scan storage QR codes on item bins. Staff can quickly scan barcodes to retrieve item details and location during student pickup.
          </p>
        </div>

        {/* Step 6: Confirm Return & Analytics */}
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>6. Return & Metrics</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">Confirming Return & Metrics</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            When the student collects the item, click <strong>"Confirm Return & Close Case"</strong>. Track recovery rates, trends, and category performance under <strong>"Analytics"</strong>.
          </p>
        </div>
      </div>

      {/* Admin Pilot Feedback Section */}
      <div className="p-6 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Submit Admin Pilot Feedback
            </h2>
            <p className="text-xs text-slate-500">
              Share operational suggestions or workflow feedback directly with Foundly Operations.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Rating (1 to 5 Stars)</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className={`p-1 text-lg ${feedbackRating >= star ? 'text-amber-500' : 'text-slate-200'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Operational Feedback & Ideas"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share feedback on review speed, storage tag usability, or student compliance..."
            rows={3}
          />

          <Button
            type="submit"
            size="sm"
            variant="primary"
            isLoading={isSubmittingFeedback}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Submit Feedback
          </Button>
        </form>
      </div>

      {/* Support & Owner Contact Banner */}
      <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Need Technical Assistance or Platform Escalation?</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            For campus partition configuration, security updates, or policy support, reach out to Foundly Platform Operations.
          </p>
        </div>
        <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3.5 py-2 rounded-xl shrink-0">
          Contact Foundly Owner: support@foundly.edu
        </div>
      </div>
    </div>
  );
};
