import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const SignupPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { signUp, configuredCollege, user, role, isLoading: isAuthLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user && role && !isSuccess && role !== 'retired_owner') {
      navigate(role === 'college_admin' ? '/admin' : '/student');
    }
  }, [isAuthLoading, user, role, isSuccess, navigate]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
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
      errs.email = 'Enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 6) {
      errs.password = 'Minimum 6 characters.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm your password.';
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

    const result = await signUp(fullName, email, password, configuredCollege?.id);
    setIsLoading(false);

    if (result.error) {
      showToast({
        type: 'error',
        title: 'Sign up failed',
        message: result.error,
      });
      setErrors({ form: result.error });
      return;
    }

    setIsSuccess(true);
    showToast({
      type: 'success',
      title: 'Account created',
      message: 'Your student account is ready.',
    });

    if (result.needsEmailConfirmation) {
      setConfirmationNotice('Check your email to verify your account before logging in.');
    } else {
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/student');
      }, 1200);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto px-4 py-14">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Create account</h1>
          <p className="text-xs text-slate-500 mt-1">
            {configuredCollege?.name || 'Galgotias University'}
          </p>
        </div>

        {isSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Account created</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {confirmationNotice || 'Redirecting to your student portal.'}
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate(confirmationNotice ? '/login' : '/student')}
              >
                {confirmationNotice ? 'Go to Log in' : 'Continue'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errors.form}</span>
              </div>
            )}

            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aarav Sharma"
              error={errors.fullName}
              leftIcon={<User className="w-4 h-4" />}
              requiredIndicator
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@galgotiasuniversity.edu.in"
              error={errors.email}
              leftIcon={<Mail className="w-4 h-4" />}
              requiredIndicator
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 chars"
                error={errors.password}
                leftIcon={<Lock className="w-4 h-4" />}
                requiredIndicator
              />

              <Input
                label="Confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat"
                error={errors.confirmPassword}
                leftIcon={<Lock className="w-4 h-4" />}
                requiredIndicator
              />
            </div>

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Create account
            </Button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-indigo-600 font-medium hover:text-indigo-700"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
};
