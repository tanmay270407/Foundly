import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Button } from './components/ui/Button';

// Public pages
import { LandingPage } from './pages/public/LandingPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { LoginPage } from './pages/public/LoginPage';
import { SignupPage } from './pages/public/SignupPage';
import { AdminLoginPage } from './pages/public/AdminLoginPage';

// Student & Shared pages
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
import { AdminMatchesPage } from './pages/admin/AdminMatchesPage';
import { AdminClaimsPage } from './pages/admin/AdminClaimsPage';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminExportPage } from './pages/admin/AdminExportPage';
import { AdminActivityLogsPage } from './pages/admin/AdminActivityLogsPage';
import { AdminGuidePage } from './pages/admin/AdminGuidePage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminProfilePage } from './pages/admin/AdminProfilePage';

const DiscontinuedRouteView: React.FC = () => {
  const { navigate } = useRouter();
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            404 • Route Discontinued
          </span>
          <h1 className="text-xl font-bold text-slate-900">This Page Is No Longer Available</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Foundly now operates as a unified single-college Lost &amp; Found system with Student and College Admin portals. Legacy Owner Portal and public admin application routes have been retired.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { user, role, configuredCollege } = useAuth();

  const isDiscontinuedRoute =
    currentPath === '/owner' ||
    currentPath.startsWith('/owner/') ||
    currentPath === '/admin-application' ||
    currentPath.startsWith('/admin-application/');

  // Route dispatcher with role-based access control
  const renderCurrentView = () => {
    if (isDiscontinuedRoute) {
      return <DiscontinuedRouteView />;
    }

    // Dynamic item route matcher: /student/item/:id
    if (currentPath.startsWith('/student/item/')) {
      return (
        <ProtectedRoute allowedRoles={['student', 'college_admin']}>
          <ItemDetailPage />
        </ProtectedRoute>
      );
    }

    switch (currentPath) {
      // Public routes
      case '/':
        return <LandingPage />;
      case '/browse':
        return <BrowseItemsPage />;
      case '/how-it-works':
        return <HowItWorksPage />;
      case '/help':
        return <StudentHelpPage />;
      case '/login':
        return <LoginPage />;
      case '/signup':
        return <SignupPage />;
      case '/admin-login':
        return <AdminLoginPage />;

      // Protected Student routes (/student/*)
      case '/student':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <StudentDashboard />
          </ProtectedRoute>
        );
      case '/student/browse':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <BrowseItemsPage />
          </ProtectedRoute>
        );
      case '/student/report-lost':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <ReportLostPage />
          </ProtectedRoute>
        );
      case '/student/report-found':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <ReportFoundPage />
          </ProtectedRoute>
        );
      case '/student/reports':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <MyActivityPage initialTab="REPORTS" />
          </ProtectedRoute>
        );
      case '/student/claims':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <MyActivityPage initialTab="CLAIMS" />
          </ProtectedRoute>
        );
      case '/student/activity':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <MyActivityPage />
          </ProtectedRoute>
        );
      case '/student/notifications':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <StudentNotificationsPage />
          </ProtectedRoute>
        );
      case '/student/profile':
        return (
          <ProtectedRoute allowedRoles={['student', 'college_admin']}>
            <StudentProfilePage />
          </ProtectedRoute>
        );

      // Protected College Admin routes (/admin/*)
      case '/admin':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        );
      case '/admin/lost-reports':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminReportsPage mode="LOST" />
          </ProtectedRoute>
        );
      case '/admin/found-reports':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminReportsPage mode="FOUND" />
          </ProtectedRoute>
        );
      case '/admin/matches':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminMatchesPage />
          </ProtectedRoute>
        );
      case '/admin/items':
      case '/admin/reports':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminReportsPage mode="ALL" />
          </ProtectedRoute>
        );
      case '/admin/claims':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminClaimsPage mode="ALL" />
          </ProtectedRoute>
        );
      case '/admin/verification':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminClaimsPage mode="VERIFICATION" />
          </ProtectedRoute>
        );
      case '/admin/handover':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminClaimsPage mode="HANDOVER" />
          </ProtectedRoute>
        );
      case '/admin/students':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminStudentsPage />
          </ProtectedRoute>
        );
      case '/admin/analytics':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminAnalyticsPage />
          </ProtectedRoute>
        );
      case '/admin/export':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminExportPage />
          </ProtectedRoute>
        );
      case '/admin/activity-logs':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminActivityLogsPage />
          </ProtectedRoute>
        );
      case '/admin/guide':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminGuidePage />
          </ProtectedRoute>
        );
      case '/admin/notifications':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminNotificationsPage />
          </ProtectedRoute>
        );
      case '/admin/profile':
        return (
          <ProtectedRoute allowedRoles={['college_admin']}>
            <AdminProfilePage />
          </ProtectedRoute>
        );

      default:
        if (currentPath.startsWith('/student')) {
          return (
            <ProtectedRoute allowedRoles={['student', 'college_admin']}>
              <StudentDashboard />
            </ProtectedRoute>
          );
        }
        if (currentPath.startsWith('/admin')) {
          return (
            <ProtectedRoute allowedRoles={['college_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          );
        }
        return <LandingPage />;
    }
  };

  const isPublicLayout =
    isDiscontinuedRoute ||
    currentPath === '/' ||
    currentPath === '/browse' ||
    currentPath === '/how-it-works' ||
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/admin-login' ||
    (currentPath === '/help' && !user);

  // Footer is displayed ONLY on the landing page ('/')
  const showFooter = currentPath === '/';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFB] text-slate-900 antialiased">
      {/* Global Navbar */}
      <Navbar />

      {/* Main Content Area */}
      {isPublicLayout ? (
        <main className="flex-1 flex flex-col">{renderCurrentView()}</main>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 lg:py-8 gap-8">
          {/* Desktop Role Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <Sidebar />
          </aside>

          {/* Primary View */}
          <main className="flex-1 min-w-0">{renderCurrentView()}</main>
        </div>
      )}

      {/* Quiet Footer (landing page only) */}
      {showFooter && (
        <footer className="border-t border-slate-200/80 bg-white py-8 mt-auto">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-900">Foundly</span>
              <span className="text-slate-300">·</span>
              <span>{configuredCollege?.name || 'Galgotias University'}</span>
              {configuredCollege?.office_location && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{configuredCollege.office_location}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <span>&copy; {new Date().getFullYear()}</span>
              {role !== 'college_admin' && (
                <button
                  type="button"
                  onClick={() => navigate('/admin-login')}
                  className="hover:text-slate-700 transition-colors"
                >
                  Admin Portal
                </button>
              )}
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
