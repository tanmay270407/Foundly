import React, { useState } from 'react';
import {
  Compass,
  Bell,
  User,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Home,
  Search,
  AlertTriangle,
  PlusCircle,
  FileText,
  CheckSquare,
  HelpCircle,
  Package,
  Sparkles,
  PackageCheck,
  Users,
  BarChart3,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { user, profile, role: authRole, isLoading: isAuthLoading, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isAuthResolving = isAuthLoading || Boolean(user && !authRole);
  const isAdmin = Boolean(user && authRole === 'college_admin');
  const isStudent = Boolean(user && authRole === 'student');
  const isPublic = !user && !isAuthLoading;

  const isPublicRoute =
    currentPath === '/' ||
    currentPath === '/browse' ||
    currentPath === '/how-it-works' ||
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/admin-login' ||
    (currentPath === '/help' && !user);

  const handleNav = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    setIsMobileMenuOpen(false);
    await signOut();
    navigate('/');
  };

  const mobileLinks = isAdmin
    ? [
        { label: 'Dashboard', path: '/admin', icon: Home },
        { label: 'Lost Reports', path: '/admin/lost-reports', icon: AlertTriangle },
        { label: 'Found Reports', path: '/admin/found-reports', icon: Package },
        { label: 'Matches', path: '/admin/matches', icon: Sparkles },
        { label: 'All Items', path: '/admin/items', icon: Search },
        { label: 'Claims', path: '/admin/claims', icon: CheckSquare },
        { label: 'Verification', path: '/admin/verification', icon: ShieldCheck },
        { label: 'Handover', path: '/admin/handover', icon: PackageCheck },
        { label: 'Students', path: '/admin/students', icon: Users },
        { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
        { label: 'Export', path: '/admin/export', icon: FileSpreadsheet },
        { label: 'Activity Logs', path: '/admin/activity-logs', icon: Activity },
        { label: 'Profile', path: '/admin/profile', icon: User },
      ]
    : isStudent
    ? [
        { label: 'Home', path: '/student', icon: Home },
        { label: 'Browse Items', path: '/student/browse', icon: Search },
        { label: 'Report Lost', path: '/student/report-lost', icon: AlertTriangle },
        { label: 'Report Found', path: '/student/report-found', icon: PlusCircle },
        { label: 'My Reports', path: '/student/reports', icon: FileText },
        { label: 'My Claims', path: '/student/claims', icon: CheckSquare },
        { label: 'Notifications', path: '/student/notifications', icon: Bell },
        { label: 'Help', path: '/help', icon: HelpCircle },
        { label: 'Profile', path: '/student/profile', icon: User },
      ]
    : [
        { label: 'Browse Items', path: '/browse', icon: Search },
        { label: 'How It Works', path: '/how-it-works', icon: Compass },
        { label: 'Help', path: '/help', icon: HelpCircle },
      ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand Wordmark */}
        <div className="flex items-center gap-6 min-w-0">
          <button
            type="button"
            onClick={() => handleNav(isPublic ? '/' : isAdmin ? '/admin' : '/student')}
            className="flex items-center gap-2 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-lg"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-[0_1px_2px_rgba(79,70,229,0.3)] group-hover:bg-indigo-700 transition-colors">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-900">
              Foundly
            </span>
          </button>

          {/* Public Desktop Nav Links (only when public or on public route without sidebar) */}
          {(isPublic || isPublicRoute) && (
            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              <button
                type="button"
                onClick={() => handleNav(isStudent ? '/student/browse' : '/browse')}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  currentPath === '/browse' || currentPath === '/student/browse'
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Browse
              </button>
              <button
                type="button"
                onClick={() => handleNav('/how-it-works')}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  currentPath === '/how-it-works'
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => handleNav('/help')}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  currentPath === '/help'
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Help
              </button>
            </nav>
          )}
        </div>

        {/* Right: Utility Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthResolving ? (
            <div className="flex items-center gap-2" aria-label="Loading session">
              <div className="w-7 h-7 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="hidden sm:block w-16 h-3 rounded bg-slate-200/80 animate-pulse" />
            </div>
          ) : user && authRole ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isStudent && !currentPath.startsWith('/student/report') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleNav('/student/report-found')}
                  className="hidden sm:inline-flex"
                >
                  Report Found
                </Button>
              )}

              {/* Notifications Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white ring-2 ring-white tabular-nums">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsNotificationsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-[0_12px_36px_rgba(15,23,42,0.12)] overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-slate-900">
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await markAllAsRead();
                            }}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-10 text-center">
                            <p className="text-xs font-medium text-slate-500">All caught up</p>
                          </div>
                        ) : (
                          notifications.slice(0, 8).map((notif) => {
                            const [mainType, relatedId] = notif.type.includes(':')
                              ? notif.type.split(':')
                              : [notif.type, ''];

                            const handleNotificationClick = async () => {
                              setIsNotificationsOpen(false);
                              await markAsRead(notif.id);

                              if (isStudent) {
                                if (mainType === 'AI_MATCH_SUGGESTED' || mainType === 'POSSIBLE_MATCH') {
                                  navigate(relatedId ? `/student/item/${relatedId}` : '/student');
                                } else if (mainType.includes('CLAIM')) {
                                  navigate('/student/claims');
                                } else if (relatedId) {
                                  navigate(`/student/item/${relatedId}`);
                                } else {
                                  navigate('/student/reports');
                                }
                              } else if (isAdmin) {
                                if (mainType.includes('CLAIM')) {
                                  navigate('/admin/claims');
                                } else if (mainType === 'AI_MATCH_SUGGESTED' || mainType === 'POSSIBLE_MATCH') {
                                  navigate('/admin/matches');
                                } else {
                                  navigate('/admin/items');
                                }
                              } else {
                                navigate('/');
                              }
                            };

                            return (
                              <button
                                key={notif.id}
                                type="button"
                                onClick={handleNotificationClick}
                                className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                                  !notif.read ? 'bg-indigo-50/30' : ''
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                                    !notif.read ? 'bg-indigo-600' : 'bg-transparent'
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 truncate">
                                    {notif.title}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                    {notif.message}
                                  </p>
                                  <span className="text-[11px] text-slate-400 block mt-1 tabular-nums">
                                    {new Date(notif.created_at).toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            navigate(isAdmin ? '/admin/notifications' : '/student/notifications');
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                        >
                          View all
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile Button */}
              <button
                type="button"
                onClick={() => handleNav(isAdmin ? '/admin/profile' : '/student/profile')}
                className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-100 rounded-lg transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                title={isAdmin ? 'Admin Profile' : 'Student Profile'}
              >
                <div
                  className={`w-7 h-7 rounded-full font-semibold flex items-center justify-center text-xs border overflow-hidden shrink-0 ${
                    isAdmin
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isAdmin && profile?.avatar_url && !profile.avatar_url.startsWith('[SUSPENDED]') ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || 'Admin'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : isAdmin ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  ) : profile?.full_name ? (
                    profile.full_name.charAt(0).toUpperCase()
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="hidden md:inline text-[13px] font-medium text-slate-700 truncate max-w-[120px]">
                  {profile?.full_name || user.email?.split('@')[0]}
                </span>
              </button>

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden sm:inline-flex w-8 h-8 items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleNav('/login')}>
                Log in
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleNav('/signup')}>
                Sign up
              </Button>
            </div>
          )}

          {/* Mobile Drawer Trigger (shown < lg when authenticated, < md when public) */}
          <div className={user && !isPublicRoute ? 'lg:hidden flex items-center' : 'md:hidden flex items-center'}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200/80 bg-white px-4 py-3 shadow-lg max-h-[80vh] overflow-y-auto">
          <nav className="grid grid-cols-1 gap-0.5">
            {mobileLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentPath === item.path ||
                (item.path !== '/student' &&
                  item.path !== '/admin' &&
                  item.path !== '/' &&
                  currentPath.startsWith(item.path + '/'));
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNav(item.path)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {user ? (
            <div className="pt-3 mt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleSignOut}
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
              >
                Log out
              </Button>
            </div>
          ) : (
            <div className="pt-3 mt-3 border-t border-slate-100 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleNav('/login')}>
                Log in
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => handleNav('/signup')}>
                Sign up
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
