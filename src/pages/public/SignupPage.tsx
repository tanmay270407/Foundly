import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getCollegesFromDb, isSupabaseConfigured } from '../../lib/supabase';
import { College } from '../../types';
import { User, Mail, Lock, Building2, UserPlus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

export const SignupPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { signUp, isConfigured } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [collegeId, setCollegeId] = useState('');
  
  const [colleges, setColleges] = useState<College[]>([]);
  const [isFetchingColleges, setIsFetchingColleges] = useState(true);
  const [collegeError, setCollegeError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  // Load real colleges from Supabase database
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      setIsFetchingColleges(true);
      setCollegeError(null);
      const { data, error } = await getCollegesFromDb();
      if (!isMounted) return;

      if (error && error !== 'SUPABASE_NOT_CONFIGURED') {
        setCollegeError('Could not load college directory. Please refresh.');
      }
      setColleges(data || []);
      setIsFetchingColleges(false);
    }

    loadColleges();
    return () => {
      isMounted = false;
    };
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please provide a valid email format.';
    }

    if (!collegeId) {
      if (colleges.length === 0) {
        errs.collegeId = 'No colleges are available yet.';
      } else {
        errs.collegeId = 'Please select your affiliated college.';
      }
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirmation password is required.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    const result = await signUp(fullName, email, password, collegeId);
    setIsLoading(false);

    if (result.error) {
      showToast({
        type: 'error',
        title: 'Signup Failed',
        message: result.error,
      });
      setErrors({ form: result.error });
      return;
    }

    setIsSuccess(true);
    showToast({
      type: 'success',
      title: 'Account Created',
      message: 'Account created successfully.',
    });

    if (result.needsEmailConfirmation) {
      setConfirmationNotice('Please check your email to verify your account before logging in.');
    } else {
      // Auto redirect to student dashboard
      setTimeout(() => {
        navigate('/student');
      }, 1500);
    }
  };

  const collegeOptions = colleges
    .filter((c) => !c.domain?.startsWith('[DEACTIVATED]'))
    .map((c) => ({
      value: c.id,
      label: `${c.name} (${c.code})`,
    }));

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Signup</h1>
          <p className="text-xs text-slate-500 mt-1">
            Join your college's official Lost & Found network
          </p>
        </div>

        {isSuccess ? (
          <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-emerald-950">Account created successfully.</h3>
            <p className="text-xs text-emerald-800 leading-relaxed max-w-sm mx-auto">
              {confirmationNotice || 'Your student profile has been created and securely linked to your college campus.'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button size="sm" variant="primary" onClick={() => navigate('/login')}>
                Go to Sign In
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errors.form}</span>
              </div>
            )}

            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Smith"
              error={errors.fullName}
              leftIcon={<User className="w-4 h-4" />}
              requiredIndicator
            />

            <Input
              label="College Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@college.edu"
              error={errors.email}
              helperText="Prefer your official .edu campus address"
              leftIcon={<Mail className="w-4 h-4" />}
              requiredIndicator
            />

            <div>
              <Select
                label="Select College Campus"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                placeholder={
                  isFetchingColleges
                    ? 'Loading colleges from database...'
                    : colleges.length === 0
                    ? 'No colleges are available yet.'
                    : 'Choose your college...'
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                error={errors.password}
                leftIcon={<Lock className="w-4 h-4" />}
                requiredIndicator
              />

              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                error={errors.confirmPassword}
                leftIcon={<Lock className="w-4 h-4" />}
                requiredIndicator
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Multi-College Security:</strong> New student accounts are assigned the verified student role and strictly bound to your campus.
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isLoading}
              disabled={isFetchingColleges}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
};
