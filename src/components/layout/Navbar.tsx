import React, { useState } from 'react';
import { 
  Compass, 
  PlusCircle, 
  Search, 
  Bell, 
  User, 
  Menu, 
  X, 
  ShieldCheck, 
  GraduationCap, 
  Building2, 
  ChevronDown,
  ArrowRight,
  LogOut,
  FileText,
  CheckSquare,
  Users
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { user, profile, role: authRole, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Production authentication determination directly from Supabase auth state & profile role
  const isStudent = Boolean(user && (!authRole || authRole === 'student'));
  const isAdmin = Boolean(user && authRole === 'college_admin');
  const isOwner = Boolean(user && authRole === 'foundly_owner');
  const isPublic = !user;

  const handleNav = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    handleNav('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNav(isPublic ? '/' : isStudent ? '/student' : isAdmin ? '/admin' : '/owner')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:bg-indigo-700 transition">
              <Compass className="w-5 h-5 transition-transform group-hover:rotate-12" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 block leading-none">
                FOUNDLY
              </span>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase block mt-0.5">
                Lost &amp; Found
              </span>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links (shifted to left side next to brand logo) */}
        <nav className="hidden md:flex items-center gap-1 mr-auto ml-4">
          {/* Unauthenticated Visitor Navigation */}
          {isPublic && (
            <button
              onClick={() => handleNav('/')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                currentPath === '/' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Home
            </button>
          )}

          {/* Authenticated Student Navigation */}
          {isStudent && (
            <>
              <button
                onClick={() => handleNav('/student')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/student' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => handleNav('/student/browse')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/student/browse' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Find an Item
              </button>
              <button
                onClick={() => handleNav('/student/report-lost')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/student/report') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Report Lost/Found
              </button>
              <button
                onClick={() => handleNav('/student/activity')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/student/activity' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Reports
              </button>
              <button
                onClick={() => handleNav('/student/activity')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/student/activity' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Claims
              </button>
            </>
          )}

          {/* Authenticated College Admin Navigation */}
          {isAdmin && (
            <>
              <button
                onClick={() => handleNav('/admin')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/admin' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Dashboard
              </button>
              <button
                onClick={() => handleNav('/admin/reports')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/admin/reports') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Items
              </button>
              <button
                onClick={() => handleNav('/admin/reports')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/admin/reports') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => handleNav('/admin/claims')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/admin/claims') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Claims
              </button>
              <button
                onClick={() => handleNav('/admin/students')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/admin/students') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Verification
              </button>
            </>
          )}

          {/* Authenticated Owner Navigation */}
          {isOwner && (
            <button
              onClick={() => handleNav('/owner')}
              className="px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Foundly Owner Portal</span>
            </button>
          )}
        </nav>

        {/* Right Side User Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              {/* Report Lost Action for Quick Student Reporting */}
              {isStudent && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleNav('/student/report-lost')}
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                  className="hidden sm:inline-flex"
                >
                  Report Lost
                </Button>
              )}

              {/* In-App Notification Center Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition relative focus:outline-none"
                  aria-label="Toggle notifications menu"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    
                    <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">Notifications</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              await markAllAsRead();
                            }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-medium text-slate-500">No new alerts</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">We'll notify you when items or claims update.</p>
                          </div>
                        ) : (
                          notifications.slice(0, 10).map((notif) => {
                            const [mainType, relatedId] = notif.type.includes(':') 
                              ? notif.type.split(':') 
                              : [notif.type, ''];
                              
                            const handleNotificationClick = async () => {
                              setIsNotificationsOpen(false);
                              await markAsRead(notif.id);
                              
                              if (isStudent) {
                                if (mainType === 'AI_MATCH_SUGGESTED' || mainType === 'POSSIBLE_MATCH') {
                                  navigate('/student/activity');
                                } else if (relatedId) {
                                  navigate(`/student/item/${relatedId}`);
                                } else {
                                  navigate('/student/activity');
                                }
                              } else if (isAdmin) {
                                if (mainType.includes('CLAIM')) {
                                  navigate('/admin/claims');
                                } else {
                                  navigate('/admin/reports');
                                }
                              } else if (isOwner) {
                                navigate('/owner/admin-requests');
                              } else {
                                navigate('/');
                              }
                            };

                            return (
                              <button
                                key={notif.id}
                                onClick={handleNotificationClick}
                                className={`w-full px-4 py-3 text-left hover:bg-slate-50/80 transition flex items-start gap-3 ${
                                  !notif.read ? 'bg-indigo-50/20' : ''
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                                  !notif.read ? 'bg-indigo-600' : 'bg-transparent'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate">{notif.title}</p>
                                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                                    {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="p-2 border-t border-slate-100 bg-slate-50/30 text-center">
                        <button
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            if (isStudent) {
                              navigate('/student/notifications');
                            } else if (isAdmin) {
                              navigate('/admin/notifications');
                            } else {
                              navigate('/owner/activity');
                            }
                          }}
                          className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition"
                        >
                          View all notifications
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile Link Button */}
              <button
                onClick={() => handleNav(isStudent ? '/student/profile' : isAdmin ? '/admin/profile' : '/owner')}
                className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-xl transition text-left"
                title="View Profile"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs border border-indigo-200">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="hidden lg:flex flex-col">
                  <span className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                    {profile?.full_name || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                    {authRole === 'college_admin' ? 'Admin' : authRole === 'foundly_owner' ? 'Owner' : 'Student'}
                  </span>
                </div>
              </button>

              {/* Logout Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-xs"
                leftIcon={<LogOut className="w-3.5 h-3.5 text-slate-400" />}
              >
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('/admin-application')}
                className={`hidden md:inline-flex px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/admin-application' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                College Admin Application
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNav('/login')}
              >
                Log In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNav('/signup')}
              >
                Sign Up
              </Button>
            </div>
          )}

          {/* Mobile Menu Hamburger Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {/* Mobile: Visitor */}
          {isPublic && (
            <>
              <button
                onClick={() => handleNav('/')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Home
              </button>
              <button
                onClick={() => handleNav('/admin-application')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                College Admin Application
              </button>
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleNav('/login')}>
                  Log In
                </Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => handleNav('/signup')}>
                  Sign Up
                </Button>
              </div>
            </>
          )}

          {/* Mobile: Authenticated Student */}
          {isStudent && (
            <>
              <button
                onClick={() => handleNav('/student')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Home
              </button>
              <button
                onClick={() => handleNav('/student/browse')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Find an Item
              </button>
              <button
                onClick={() => handleNav('/student/report-lost')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Report Lost/Found
              </button>
              <button
                onClick={() => handleNav('/student/activity')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                My Reports
              </button>
              <button
                onClick={() => handleNav('/student/activity')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                My Claims
              </button>
              <button
                onClick={() => handleNav('/student/notifications')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Notifications
              </button>
              <button
                onClick={() => handleNav('/student/profile')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Profile
              </button>
              <div className="pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} leftIcon={<LogOut className="w-3.5 h-3.5" />}>
                  Logout
                </Button>
              </div>
            </>
          )}

          {/* Mobile: Authenticated College Admin */}
          {isAdmin && (
            <>
              <button
                onClick={() => handleNav('/admin')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Admin Dashboard
              </button>
              <button
                onClick={() => handleNav('/admin/reports')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Items
              </button>
              <button
                onClick={() => handleNav('/admin/reports')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Reports
              </button>
              <button
                onClick={() => handleNav('/admin/claims')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Claims
              </button>
              <button
                onClick={() => handleNav('/admin/students')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Verification
              </button>
              <button
                onClick={() => handleNav('/admin/notifications')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Notifications
              </button>
              <button
                onClick={() => handleNav('/admin/profile')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Profile
              </button>
              <div className="pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} leftIcon={<LogOut className="w-3.5 h-3.5" />}>
                  Logout
                </Button>
              </div>
            </>
          )}

          {/* Mobile: Authenticated Owner */}
          {isOwner && (
            <>
              <button
                onClick={() => handleNav('/owner')}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-purple-700 bg-purple-50 rounded-lg"
              >
                Open Foundly Owner Portal
              </button>
              <div className="pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} leftIcon={<LogOut className="w-3.5 h-3.5" />}>
                  Logout
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
};
