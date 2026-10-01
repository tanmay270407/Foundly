import React from 'react';
import { Building2, ShieldCheck, ArrowRight } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Public pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { SignupPage } from './pages/public/SignupPage';
import { AdminApplicationPage } from './pages/public/AdminApplicationPage';

// Student pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { BrowseItemsPage } from './pages/student/BrowseItemsPage';
import { ReportLostPage } from './pages/student/ReportLostPage';
import { ReportFoundPage } from './pages/student/ReportFoundPage';
import { ItemDetailPage } from './pages/student/ItemDetailPage';
import { MyActivityPage } from './pages/student/MyActivityPage';
import { StudentNotificationsPage } from './pages/student/StudentNotificationsPage';
import { StudentProfilePage } from './pages/student/StudentProfilePage';
import { StudentHelpPage } from './pages/StudentHelpPage';

// College Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminClaimsPage } from './pages/admin/AdminClaimsPage';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminGuidePage } from './pages/admin/AdminGuidePage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminProfilePage } from './pages/admin/AdminProfilePage';

// Foundly Owner pages
import { OwnerDashboard } from './pages/owner/OwnerDashboard';
import { OwnerCollegesPage } from './pages/owner/OwnerCollegesPage';
import { OwnerAdminRequestsPage } from './pages/owner/OwnerAdminRequestsPage';
import { OwnerAdminsPage } from './pages/owner/OwnerAdminsPage';
import { OwnerAnalyticsPage } from './pages/owner/OwnerAnalyticsPage';
import { OwnerHealthPage } from './pages/owner/OwnerHealthPage';
import { OwnerActivityPage } from './pages/owner/OwnerActivityPage';
import { OwnerRolloutPage } from './pages/owner/OwnerRolloutPage';
import { OwnerPilotPage } from './pages/owner/OwnerPilotPage';

const AppContent: React.FC = () => {
  const { currentPath, perspective, navigate, setPerspective } = useRouter();
  const { role } = useAuth();

  const hideAdminFooterBlock = 
    currentPath.startsWith('/admin') || 
    currentPath.startsWith('/owner') || 
    perspective === 'COLLEGE_ADMIN' || 
    perspective === 'FOUNDLY_OWNER' || 
    role === 'college_admin' || 
    role === 'foundly_owner';

  // Route dispatcher with role-based access control
  const renderCurrentView = () => {
    // Dynamic item route matcher: /student/item/:id
    if (currentPath.startsWith('/student/item/')) {
      return (
        <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
          <ItemDetailPage />
        </ProtectedRoute>
      );
    }

    switch (currentPath) {
      // Public routes
      case '/':
        return <LandingPage />;
      case '/login':
        return <LoginPage />;
      case '/signup':
        return <SignupPage />;
      case '/admin-application':
        return <AdminApplicationPage />;

      // Protected Student routes (/student/*)
      case '/student':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <StudentDashboard />
          </ProtectedRoute>
        );
      case '/student/browse':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <BrowseItemsPage />
          </ProtectedRoute>
        );
      case '/student/report-lost':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <ReportLostPage />
          </ProtectedRoute>
        );
      case '/student/report-found':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <ReportFoundPage />
          </ProtectedRoute>
        );
      case '/student/activity':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <MyActivityPage />
          </ProtectedRoute>
        );
      case '/student/notifications':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <StudentNotificationsPage />
          </ProtectedRoute>
        );
      case '/student/profile':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <StudentProfilePage />
          </ProtectedRoute>
        );
      case '/help':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
            <StudentHelpPage />
          </ProtectedRoute>
        );

      // Protected College Admin routes (/admin/*)
      case '/admin':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminDashboard />
          </ProtectedRoute>
        );
      case '/admin/reports':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminReportsPage />
          </ProtectedRoute>
        );
      case '/admin/claims':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminClaimsPage />
          </ProtectedRoute>
        );
      case '/admin/students':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminStudentsPage />
          </ProtectedRoute>
        );
      case '/admin/analytics':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminAnalyticsPage />
          </ProtectedRoute>
        );
      case '/admin/guide':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminGuidePage />
          </ProtectedRoute>
        );
      case '/admin/notifications':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminNotificationsPage />
          </ProtectedRoute>
        );
      case '/admin/profile':
        return (
          <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
            <AdminProfilePage />
          </ProtectedRoute>
        );

      // Protected Foundly Owner routes (/owner/*)
      case '/owner':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerDashboard />
          </ProtectedRoute>
        );
      case '/owner/colleges':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerCollegesPage />
          </ProtectedRoute>
        );
      case '/owner/rollout':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerRolloutPage />
          </ProtectedRoute>
        );
      case '/owner/pilot':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerPilotPage />
          </ProtectedRoute>
        );
      case '/owner/admin-requests':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerAdminRequestsPage />
          </ProtectedRoute>
        );
      case '/owner/admins':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerAdminsPage />
          </ProtectedRoute>
        );
      case '/owner/analytics':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerAnalyticsPage />
          </ProtectedRoute>
        );
      case '/owner/health':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerHealthPage />
          </ProtectedRoute>
        );
      case '/owner/activity':
        return (
          <ProtectedRoute allowedRoles={['foundly_owner']}>
            <OwnerActivityPage />
          </ProtectedRoute>
        );

      default:
        // Safe fallback according to route prefix
        if (currentPath.startsWith('/student')) {
          return (
            <ProtectedRoute allowedRoles={['student', 'college_admin', 'foundly_owner']}>
              <StudentDashboard />
            </ProtectedRoute>
          );
        }
        if (currentPath.startsWith('/admin') && currentPath !== '/admin-application') {
          return (
            <ProtectedRoute allowedRoles={['college_admin', 'foundly_owner']}>
              <AdminDashboard />
            </ProtectedRoute>
          );
        }
        if (currentPath.startsWith('/owner')) {
          return (
            <ProtectedRoute allowedRoles={['foundly_owner']}>
              <OwnerDashboard />
            </ProtectedRoute>
          );
        }
        return <LandingPage />;
    }
  };

  const isPublicLayout = 
    currentPath === '/' || 
    currentPath === '/login' || 
    currentPath === '/signup' || 
    currentPath === '/admin-application';

  // The footer is shown only on the 1st page (home page '/') and removed from admin sign in dashboard & inner views
  const showFooter = currentPath === '/';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Global Navbar */}
      <Navbar />

      {/* Main Content Area */}
      {isPublicLayout ? (
        <main className="flex-1 flex flex-col">
          {renderCurrentView()}
        </main>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 gap-6">
          {/* Role Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <Sidebar />
          </aside>

          {/* Primary View */}
          <main className="flex-1 min-w-0">
            {renderCurrentView()}
          </main>
        </div>
      )}

      {/* Footer (only displayed on the 1st page) */}
      {showFooter && (
        <footer className="border-t border-slate-200/80 bg-white py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
            {/* Main Footer Row */}
            <div className={`flex flex-col md:flex-row md:items-center gap-6 pb-6 border-b border-slate-100 ${
              hideAdminFooterBlock ? 'justify-center text-center' : 'justify-between'
            }`}>
              {/* Brand column */}
              <div className={`space-y-1.5 ${hideAdminFooterBlock ? 'flex flex-col items-center text-center mx-auto' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    F
                  </div>
                  <span className="font-bold text-slate-900 tracking-tight text-sm">Foundly</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs text-slate-500 font-medium">Campus Lost &amp; Found Network</span>
                </div>
                <p className={`text-[11px] text-slate-400 max-w-md leading-relaxed ${hideAdminFooterBlock ? 'text-center' : ''}`}>
                  Empowering college campuses with secure, verifiable lost and found item recovery and multi-campus isolation.
                </p>
              </div>

              {/* College Administration Section in Footer */}
              {!hideAdminFooterBlock && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        College Administration
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Campus staff &amp; authorized representatives
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 sm:pt-0 sm:pl-3 sm:border-l sm:border-slate-200">
                    <button
                      onClick={() => {
                        navigate('/admin-application');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                      title="Apply for College Administrator credentials"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>College Admin Signup Application</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subfooter Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
              <span>&copy; {new Date().getFullYear()} Foundly. All campus rights reserved.</span>
              <div className="flex items-center gap-4">
                <span>Supabase Auth &amp; RLS Architecture</span>
                <span>•</span>
                <span>Multi-College Isolation Active</span>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <RouterProvider>
            <AppContent />
          </RouterProvider>
        </NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
