import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { signIn, configuredCollege, user, role, isLoading: isAuthLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user && role && role !== 'retired_owner') {
      navigate(role === 'college_admin' ? '/admin' : '/student');
    }
  }, [isAuthLoading, user, role, navigate]);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
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

    const result = await signIn(email, password);
    setIsLoading(false);

    if (result.error) {
      setErrors({ form: result.error });
      showToast({
        type: 'error',
        title: 'Sign in failed',
        message: result.error,
      });
      return;
    }

    showToast({
      type: 'success',
      title: 'Signed in',
      message: 'Welcome back.',
    });

    const userRole = result.role?.toLowerCase();
    if (userRole === 'college_admin') {
      navigate('/admin');
    } else {
      navigate('/student');
    }
  };

  return (
    <div className="w-full max-w-[400px] mx-auto px-4 py-16">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Log in</h1>
          <p className="text-xs text-slate-500 mt-1">
            {configuredCollege?.name || 'Galgotias University'}
          </p>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            error={errors.password}
            leftIcon={<Lock className="w-4 h-4" />}
            requiredIndicator
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Log in
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          New here?{' '}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="text-indigo-600 font-medium hover:text-indigo-700"
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
};
