import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/Button';
import { ShieldAlert, LogIn, ArrowLeft, Building2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: ('student' | 'college_admin' | 'foundly_owner')[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, profile, role, isLoading, isConfigured } = useAuth();
  const { navigate, currentPath } = useRouter();

  // Show clean loading state while checking session
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <LoadingState message="Verifying campus session..." />
      </div>
    );
  }

  // If Supabase is not configured yet in this environment, allow previewing with notice
  if (!isConfigured) {
    return <>{children}</>;
  }

  // 1. Unauthenticated users must be redirected to /login
  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 flex items-center justify-center mx-auto">
            <LogIn className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Authentication Required</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Please sign in with your campus account to access this section of Foundly.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/login')}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Role validation
  const effectiveRole = role || 'student';
  const isSuspended = Boolean(profile?.avatar_url?.startsWith('[SUSPENDED]'));

  // Hierarchy check:
  // - foundly_owner can access everything
  // - college_admin can access college_admin and student (unless suspended, then student only)
  // - student can only access student
  let hasPermission = false;
  if (effectiveRole === 'foundly_owner') {
    hasPermission = true;
  } else if (effectiveRole === 'college_admin') {
    if (isSuspended) {
      hasPermission = allowedRoles.includes('student') && !allowedRoles.includes('college_admin');
    } else {
      hasPermission = allowedRoles.includes('college_admin') || allowedRoles.includes('student');
    }
  } else if (effectiveRole === 'student') {
    hasPermission = allowedRoles.includes('student');
  }

  // 3. Denied View
  if (!hasPermission) {
    if (isSuspended && allowedRoles.includes('college_admin') && !allowedRoles.includes('student')) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6" id="suspended-admin-denied-view">
          <div className="w-full max-w-md bg-white border border-rose-200/80 rounded-3xl p-8 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account Suspended</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your College Administrator account has been suspended by the platform owner. Access to the Admin Panel is blocked.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/student')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Go to Student Portal
              </Button>
            </div>
          </div>
        </div>
      );
    }

    const isTargetingAdmin = allowedRoles.includes('college_admin') && !allowedRoles.includes('student');
    const isTargetingOwner = allowedRoles.includes('foundly_owner') && allowedRoles.length === 1;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-rose-200/80 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Denied</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isTargetingOwner
                ? 'This area requires Foundly Platform Owner authorization.'
                : isTargetingAdmin
                ? 'This portal is restricted to verified College Administrators for your campus.'
                : 'You do not have permission to view this page.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(effectiveRole === 'college_admin' ? '/admin' : '/student')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              My Dashboard
            </Button>
            {isTargetingAdmin && effectiveRole === 'student' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/admin-application')}
                leftIcon={<Building2 className="w-4 h-4" />}
              >
                Apply for Admin
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
