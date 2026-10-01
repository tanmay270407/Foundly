import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, getCollegesFromDb, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { College } from '../../types';
import { 
  Building2, 
  ShieldAlert, 
  User, 
  Mail, 
  Phone, 
  BadgeCheck, 
  Send, 
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { FileUpload } from '../../components/ui/FileUpload';

export const AdminApplicationPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [representativeId, setRepresentativeId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reason, setReason] = useState('');

  const [colleges, setColleges] = useState<College[]>([]);
  const [isFetchingColleges, setIsFetchingColleges] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Load real colleges from Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      setIsFetchingColleges(true);
      const { data } = await getCollegesFromDb();
      if (isMounted) {
        setColleges(data || []);
        setIsFetchingColleges(false);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required.';
    if (!email.trim()) {
      errs.email = 'Staff email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please provide a valid email format.';
    }
    if (!phone.trim()) errs.phone = 'Contact phone number is required.';
    if (!collegeId) errs.collegeId = 'Please choose your college campus.';
    if (!representativeId.trim()) errs.representativeId = 'Staff / Faculty / Officer ID is required.';
    if (!proofFile) errs.proofFile = 'Please upload proof of affiliation or campus staff credential.';
    if (!reason.trim()) errs.reason = 'Please describe your department role and intent.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      showToast({
        type: 'error',
        title: 'Backend Not Connected',
        message: 'Supabase credentials are not configured in this environment.',
      });
      return;
    }

    try {
      // Submit application record with status = 'pending'
      // Strictly does not grant admin access
      const { error } = await supabase.from('admin_requests').insert({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        college_id: collegeId,
        representative_id: representativeId.trim(),
        proof_information: proofFile ? proofFile.name : 'Uploaded credential',
        reason: reason.trim(),
        status: 'pending',
      });

      setIsLoading(false);

      if (error) {
        console.error('[AdminApplication] Failed to insert request:', error);
        const friendlyMsg = getFriendlyAuthErrorMessage(error);
        setErrors({ form: friendlyMsg });
        showToast({
          type: 'error',
          title: 'Submission Failed',
          message: friendlyMsg,
        });
        return;
      }

      setIsSubmitted(true);
      showToast({
        type: 'success',
        title: 'Application Submitted',
        message: 'Your admin application has been submitted.',
      });
    } catch (err: any) {
      setIsLoading(false);
      console.error('[AdminApplication] Network exception:', err);
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      setErrors({ form: friendlyMsg });
    }
  };

  const collegeOptions = colleges
    .filter((c) => !c.domain?.startsWith('[DEACTIVATED]'))
    .map((c) => ({
      value: c.id,
      label: `${c.name} (${c.code})`,
    }));

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              College Admin Verification
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Apply to manage lost & found operations for your campus
            </p>
          </div>
        </div>

        {isSubmitted ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Your admin application has been submitted.</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Your request is currently <span className="font-semibold text-amber-700">pending verification</span> by the Foundly Platform Owner. You will be notified when your credentials have been verified.
              </p>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                Return to Home
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/login')}>
                Sign In to Account
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errors.form}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Official Verification Required</p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Submitting this application does not grant administrator privileges. Requests are reviewed and approved individually by Foundly Platform Owners.
                </p>
              </div>
            </div>

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
                label="Campus Faculty / Staff / Officer ID"
                value={representativeId}
                onChange={(e) => setRepresentativeId(e.target.value)}
                placeholder="EMP-84920"
                error={errors.representativeId}
                leftIcon={<BadgeCheck className="w-4 h-4" />}
                requiredIndicator
              />
            </div>

            <div>
              <Select
                label="Campus Affiliation"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                placeholder={
                  isFetchingColleges
                    ? 'Loading colleges...'
                    : colleges.length === 0
                    ? 'No colleges are available yet.'
                    : 'Select your institution...'
                }
                options={collegeOptions}
                disabled={isFetchingColleges || colleges.length === 0}
                error={errors.collegeId}
                requiredIndicator
              />
              {colleges.length === 0 && !isFetchingColleges && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  No colleges are available yet.
                </p>
              )}
            </div>

            <FileUpload
              label="Staff Identification or Authority Letter"
              value={proofFile}
              onChange={(file) => setProofFile(file)}
              error={errors.proofFile}
              helperText="Upload official staff ID card, department badge, or authorization letter (PDF or PNG/JPG, max 10MB)"
            />

            <Textarea
              label="Role & Statement of Intent"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your campus office (e.g., Campus Police, Student Affairs, Facilities Desk) and your role in managing physical lost & found property."
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
                disabled={isFetchingColleges}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Submit Admin Request
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
