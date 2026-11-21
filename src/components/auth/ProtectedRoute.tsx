import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/Button';
import { ShieldAlert, LogIn, ArrowLeft, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: ('student' | 'college_admin')[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, profile, role, isLoading, isConfigured, signOut } = useAuth();
  const { currentPath, navigate } = useRouter();

  // Wait while session or role profile is still resolving to prevent transient role/access flashes
  if (isLoading || (isConfigured && user && !profile)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <LoadingState message="Verifying campus session..." />
      </div>
    );
  }

  // If Supabase is not configured yet in this environment, allow previewing UI structure
  if (!isConfigured) {
    return <>{children}</>;
  }

  const isTargetingAdminOnly =
    allowedRoles.includes('college_admin') && !allowedRoles.includes('student');

  // 1. Unauthenticated users must sign in
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
              {isTargetingAdminOnly
                ? 'Please sign in with authorized College Admin credentials to access the Admin Portal.'
                : 'Please sign in with your campus account to access this section of Foundly.'}
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Back to Home
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(isTargetingAdminOnly || currentPath.startsWith('/admin') ? '/admin-login' : '/login')}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              {isTargetingAdminOnly ? 'Admin Sign In' : 'Sign In'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveRole = role || 'student';
  const isSuspended = Boolean(profile?.avatar_url?.startsWith('[SUSPENDED]'));

  // Discontinued Owner accounts have zero access unless explicitly promoted to College Admin
  if (effectiveRole === 'retired_owner') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-rose-200/80 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Unauthorized</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              The Foundly Owner Portal has been discontinued. Former Owner accounts cannot access the application unless explicitly assigned a College Admin role.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  let hasPermission = false;
  if (effectiveRole === 'college_admin') {
    if (isSuspended) {
      hasPermission = allowedRoles.includes('student') && !allowedRoles.includes('college_admin');
    } else {
      hasPermission = allowedRoles.includes('college_admin') || allowedRoles.includes('student');
    }
  } else if (effectiveRole === 'student') {
    hasPermission = allowedRoles.includes('student');
  }

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
                Your College Administrator permissions are currently suspended. Access to the College Admin Portal is blocked.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
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

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-rose-200/80 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Denied</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isTargetingAdmin
                ? 'This portal is restricted to authorized College Administrators assigned by campus administration.'
                : 'You do not have permission to view this page.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(effectiveRole === 'college_admin' ? '/admin' : '/student')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              My Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
