import React, { useState, useEffect, FormEvent } from 'react';
import { ShieldCheck, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const AdminLoginPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { signInAdmin, configuredCollege, user, role, isLoading: isAuthLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user && role === 'college_admin') {
      navigate('/admin');
    }
  }, [isAuthLoading, user, role, navigate]);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = 'Admin email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errs.email = 'Enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    const result = await signInAdmin(email, password);
    setIsLoading(false);

    if (result.error) {
      setErrors({ form: result.error });
      showToast({
        type: 'error',
        title: 'Admin sign in failed',
        message: result.error,
      });
      return;
    }

    showToast({
      type: 'success',
      title: 'Signed in',
      message: 'Welcome to the Admin Portal.',
    });
    navigate('/admin');
  };

  return (
    <div className="w-full max-w-[400px] mx-auto px-4 py-16">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Admin Portal</h1>
            <p className="text-xs text-slate-500">
              {configuredCollege?.name || 'Galgotias University'}
            </p>
          </div>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Admin email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@campus.edu"
            error={errors.email}
            leftIcon={<Mail className="w-4 h-4" />}
            autoComplete="username"
            requiredIndicator
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            error={errors.password}
            leftIcon={<Lock className="w-4 h-4" />}
            autoComplete="current-password"
            requiredIndicator
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Sign in
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
