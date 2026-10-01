import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle2, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from './Button';

interface PilotFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PilotFeedbackModal: React.FC<PilotFeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, role } = useAuth();
  const [feature, setFeature] = useState('General Navigation / Dashboard');
  const [whatWasEasy, setWhatWasEasy] = useState('');
  const [whatWasConfusing, setWhatWasConfusing] = useState('');
  const [whatFailed, setWhatFailed] = useState('');
  const [missingFeatures, setMissingFeatures] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [overallRating, setOverallRating] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Store feedback into activity_logs or supabase
      const userRole = role || 'student';
      const userCollegeId = profile?.college_id || 'general';

      await supabase.from('activity_logs').insert([{
        college_id: userCollegeId,
        user_id: user?.id || 'anonymous_pilot_user',
        action: 'PILOT_FEEDBACK_SUBMITTED',
        entity_type: 'COLLEGE',
        entity_id: userCollegeId,
        details: {
          user_role: userRole,
          feature_used: feature,
          what_was_easy: whatWasEasy,
          what_was_confusing: whatWasConfusing,
          what_failed: whatFailed,
          missing_features: missingFeatures,
          suggestions: suggestions,
          overall_rating: overallRating,
          user_email: user?.email || 'N/A'
        }
      }]);

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error submitting pilot feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pilot Launch Feedback</h3>
              <p className="text-xs text-slate-500">Help us refine Foundly for your campus</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="text-lg font-bold text-slate-900">Thank You!</h4>
            <p className="text-xs text-slate-600">Your pilot feedback has been logged securely. We appreciate your input!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {/* Rating */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Overall Experience</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setOverallRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition"
                  >
                    <Star className={`w-6 h-6 ${star <= overallRating ? 'fill-amber-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Feature/Page used */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Page or Feature Used</label>
              <select
                value={feature}
                onChange={(e) => setFeature(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="General Navigation / Dashboard">General Navigation / Dashboard</option>
                <option value="Report Lost Item">Report Lost Item</option>
                <option value="Report Found Item">Report Found Item</option>
                <option value="Search & Browse">Search & Browse</option>
                <option value="Claim Submission">Claim Submission</option>
                <option value="Admin Approval & Handover">Admin Approval & Handover</option>
                <option value="Notifications & Emails">Notifications & Emails</option>
              </select>
            </div>

            {/* What was easy? */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">What worked well / was easy?</label>
              <input
                type="text"
                value={whatWasEasy}
                onChange={(e) => setWhatWasEasy(e.target.value)}
                placeholder="e.g., Simple image upload and clean dashboard"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* What was confusing? */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">What was confusing or unclear?</label>
              <input
                type="text"
                value={whatWasConfusing}
                onChange={(e) => setWhatWasConfusing(e.target.value)}
                placeholder="e.g., Unclear where to pick up claimed items"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* What failed? */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Did anything fail or crash?</label>
              <input
                type="text"
                value={whatFailed}
                onChange={(e) => setWhatFailed(e.target.value)}
                placeholder="None or specify if any error occurred"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* Missing feature / Suggestions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Suggestions / Feedback</label>
              <textarea
                rows={3}
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                placeholder="Any additional feedback or feature requests..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} leftIcon={<Send className="w-3.5 h-3.5" />}>
                Submit Pilot Feedback
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
