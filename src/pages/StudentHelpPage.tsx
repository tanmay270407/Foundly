import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Search, 
  FileText, 
  CheckSquare, 
  PackageCheck, 
  MapPin, 
  ShieldCheck, 
  Clock, 
  Mail, 
  Phone, 
  Building2,
  ArrowRight,
  Info,
  MessageSquare,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { getCollegeLaunchData, CollegeOperationalInfo } from '../lib/collegeLaunch';
import { submitPilotFeedback } from '../lib/collegePilot';

export const StudentHelpPage: React.FC = () => {
  const { profile, user } = useAuth();
  const { showToast } = useToast();

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [opInfo, setOpInfo] = useState<CollegeOperationalInfo>({
    contactName: 'Campus Security Desk',
    officeLocation: 'Campus Security / Lost & Found Office',
    workingHours: 'Monday - Friday, 9:00 AM - 5:00 PM',
    contactEmail: 'lostandfound@college.edu',
    contactPhone: '',
    handoverInstructions: 'Please present valid student ID or claim QR code at pickup.',
    additionalStudentInstructions: 'Verify item details before visiting the office.'
  });

  useEffect(() => {
    if (profile?.college_id) {
      getCollegeLaunchData(profile.college_id).then((data) => {
        if (data.operationalInfo) {
          setOpInfo(data.operationalInfo);
        }
      });
    }
  }, [profile?.college_id]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.college_id || !user?.id || !feedbackText.trim()) return;

    setIsSubmitting(true);
    try {
      const ok = await submitPilotFeedback(
        profile.college_id,
        user.id,
        'student',
        feedbackText.trim(),
        feedbackRating,
        profile.full_name || profile.email || user.email
      );

      if (ok) {
        showToast({
          type: 'success',
          title: 'Feedback Sent 🎉',
          message: 'Thank you! Your feedback helps improve campus lost and found operations.',
        });
        setFeedbackText('');
      } else {
        throw new Error('Could not submit feedback.');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission Error',
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in" id="student-help-root">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" />
          <span>Student Launch Guide & Operations</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Campus Lost & Found Help Center
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Simple step-by-step guide for reporting lost items, submitting claims, and collecting returned property on campus.
        </p>
      </div>

      {/* Official Campus Operational Information Box */}
      <div className="p-6 rounded-3xl bg-indigo-50/70 border border-indigo-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 uppercase tracking-wider">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>Official Campus Lost & Found Office & Contact Info</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-2xl bg-white border border-indigo-100/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact / Office</span>
            <p className="font-semibold text-slate-900">{opInfo.contactName || 'Campus Lost & Found'}</p>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-indigo-100/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-indigo-600" />
              Office Location
            </span>
            <p className="font-semibold text-slate-900">{opInfo.officeLocation || 'Main Campus Security'}</p>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-indigo-100/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-600" />
              Working Hours
            </span>
            <p className="font-semibold text-slate-900">{opInfo.workingHours || 'Mon-Fri 9AM-5PM'}</p>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-indigo-100/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Mail className="w-3 h-3 text-indigo-600" />
              Official Email
            </span>
            <p className="font-semibold text-slate-900 truncate">{opInfo.contactEmail || 'support@college.edu'}</p>
          </div>

          {opInfo.contactPhone && (
            <div className="p-3 rounded-2xl bg-white border border-indigo-100/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3 text-indigo-600" />
                Phone Number
              </span>
              <p className="font-semibold text-slate-900">{opInfo.contactPhone}</p>
            </div>
          )}
        </div>

        {opInfo.handoverInstructions && (
          <div className="p-3.5 rounded-2xl bg-white/80 border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Pickup Instructions: </span>
              <span className="text-indigo-900">{opInfo.handoverInstructions}</span>
            </div>
          </div>
        )}
      </div>

      {/* Structured Help Q&A Modules */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Student Process & Verification Workflow
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Q1: How to report a lost item */}
          <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">1</span>
              How to report a lost item?
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              Click <strong>"Report Lost Item"</strong> in the navigation bar. Enter the item name, category, lost location, approximate time, and optional photo. Once submitted, your report goes to admin review.
            </p>
          </div>

          {/* Q2: How to report a found item */}
          <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-bold">2</span>
              How to report a found item?
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              If you find unattended property, click <strong>"Report Found Item"</strong>. Specify where it was found and current custody location (e.g. handed to Campus Security).
            </p>
          </div>

          {/* Q3: How to claim an item */}
          <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">3</span>
              How to claim an item?
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              Browse the <strong>Campus Catalog</strong>. When you identify your lost item, open it and click <strong>"Claim Item"</strong>. Provide unique identifying details or upload receipt proof.
            </p>
          </div>

          {/* Q4: What happens after submitting a claim */}
          <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold">4</span>
              What happens after submitting a claim?
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              Your claim enters admin review. College Admins verify your proof against the found item records. Response time is typically within 24–48 hours.
            </p>
          </div>

          {/* Q5: How verification works */}
          <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">5</span>
              How verification works?
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              Admins compare your private proof (serial numbers, wallpaper description, lock code) against confidential found report entries. False claims are reported to student affairs.
            </p>
          </div>

          {/* Q6: What happens during handover */}
          <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">6</span>
              What happens during handover?
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              Upon approval, visit the campus Lost & Found office with your student ID or claim QR tag. The admin confirms physical ownership and logs the item as returned.
            </p>
          </div>
        </div>
      </div>

      {/* Student Pilot Feedback Section */}
      <div className="p-6 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Student Campus Pilot Feedback
            </h2>
            <p className="text-xs text-slate-500">
              How was your experience using Foundly? Your private feedback goes directly to campus operations.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Overall Rating (1 to 5 Stars)</label>
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
            label="Your Feedback / Suggestions"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Let us know what worked well or what could be improved..."
            rows={3}
          />

          <Button
            type="submit"
            size="sm"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Submit Feedback
          </Button>
        </form>
      </div>
    </div>
  );
};
