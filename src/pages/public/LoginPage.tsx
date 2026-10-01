import React, { useState, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please enter a valid email address.';
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
        title: 'Sign In Failed',
        message: result.error,
      });
      return;
    }

    showToast({
      type: 'success',
      title: 'Welcome Back',
      message: 'Signed in successfully.',
    });

    // Navigate to respective role portal based on real Supabase profile
    const userRole = result.role?.toLowerCase();
    if (userRole === 'college_admin') {
      navigate('/admin');
    } else if (userRole === 'foundly_owner') {
      navigate('/owner');
    } else {
      navigate('/student');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-xs text-slate-500 mt-1">
            Log in to your campus account to manage reports and claims
          </p>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="College or Personal Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@college.edu"
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

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isLoading}
            leftIcon={<LogIn className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Don't have an account yet?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Create student account
          </button>
        </div>
      </div>
    </div>
  );
};
