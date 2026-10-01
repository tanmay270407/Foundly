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
  SlidersHorizontal,
  ChevronDown,
  ArrowRight,
  MessageSquarePlus
} from 'lucide-react';
import { useRouter, CurrentPerspective } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { PilotFeedbackModal } from '../ui/PilotFeedbackModal';

export const Navbar: React.FC = () => {
  const { currentPath, navigate, perspective, setPerspective } = useRouter();
  const { user, profile, role: authRole, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const isPublic = perspective === 'PUBLIC';
  const isStudent = perspective === 'STUDENT';
  const isAdmin = perspective === 'COLLEGE_ADMIN';
  const isOwner = perspective === 'FOUNDLY_OWNER';

  const handleNav = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setPerspective('PUBLIC');
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
                Lost & Found
              </span>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {isPublic && (
            <>
              <button
                onClick={() => handleNav('/')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
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
                onClick={() => handleNav('/admin-application')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/admin-application' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                College Admin Application
              </button>
            </>
          )}

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
                  currentPath.startsWith('/student/browse') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Browse
              </button>
              <button
                onClick={() => handleNav('/student/activity')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/student/activity') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Activity
              </button>
            </>
          )}

          {isAdmin && (
            <>
              <button
                onClick={() => handleNav('/admin')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/admin' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dashboard
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
                Students
              </button>
            </>
          )}

          {isOwner && (
            <>
              <button
                onClick={() => handleNav('/owner')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath === '/owner' ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => handleNav('/owner/colleges')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/owner/colleges') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Colleges
              </button>
              <button
                onClick={() => handleNav('/owner/admin-requests')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/owner/admin-requests') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Requests
              </button>
              <button
                onClick={() => handleNav('/owner/admins')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/owner/admins') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admins
              </button>
              <button
                onClick={() => handleNav('/owner/activity')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  currentPath.startsWith('/owner/activity') ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Platform Activity
              </button>
            </>
          )}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5">
          {/* Pilot Feedback Trigger */}
          <button
            onClick={() => setIsFeedbackModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
            title="Submit Pilot Feedback"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Pilot Feedback</span>
          </button>

          {/* Quick Perspective / Role Switcher for seamless Phase 1 evaluation */}
          <div className="relative">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              title="Switch role view for prototype evaluation"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span className="hidden sm:inline">Role:</span>
              <span className="font-semibold text-slate-900">
                {perspective === 'PUBLIC'
                  ? 'Visitor'
                  : perspective === 'STUDENT'
                  ? 'Student'
                  : perspective === 'COLLEGE_ADMIN'
                  ? 'College Admin'
                  : 'Owner'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isRoleDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in"
                onClick={() => setIsRoleDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Select UX Perspective
                </div>
                <button
                  onClick={() => setPerspective('PUBLIC')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 ${
                    perspective === 'PUBLIC' ? 'text-indigo-600 font-semibold bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <Compass className="w-4 h-4 text-slate-400" />
                  <span>Public Landing / Visitor</span>
                </button>
                <button
                  onClick={() => setPerspective('STUDENT')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 ${
                    perspective === 'STUDENT' ? 'text-indigo-600 font-semibold bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-indigo-500" />
                  <span>Student View (/student)</span>
                </button>
                <button
                  onClick={() => setPerspective('COLLEGE_ADMIN')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 ${
                    perspective === 'COLLEGE_ADMIN' ? 'text-indigo-600 font-semibold bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-amber-500" />
                  <span>College Admin View (/admin)</span>
                </button>
                <button
                  onClick={() => setPerspective('FOUNDLY_OWNER')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 ${
                    perspective === 'FOUNDLY_OWNER' ? 'text-indigo-600 font-semibold bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                  <span>Foundly Owner View (/owner)</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Action Buttons depending on auth state & role */}
          {user ? (
            <div className="flex items-center gap-2">
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
              
              {/* Unified In-App Notification Center Dropdown */}
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
                                if (mainType.includes('ADMIN')) {
                                  navigate('/owner/admin-requests');
                                } else {
                                  navigate('/owner/activity');
                                }
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

              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">
                  {profile?.full_name || user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase">
                  {authRole || 'student'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-xs"
              >
                Sign Out
              </Button>
            </div>
          ) : isPublic ? (
            <div className="flex items-center gap-2">
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
          ) : isStudent ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNav('/student/report-lost')}
                leftIcon={<PlusCircle className="w-4 h-4" />}
                className="hidden sm:inline-flex"
              >
                Report Lost
              </Button>
              <button
                onClick={() => handleNav('/student/notifications')}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleNav('/student/profile')}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                aria-label="Student Profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          ) : isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('/admin/notifications')}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                aria-label="Admin Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleNav('/admin/profile')}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                aria-label="Admin Profile"
              >
                <Building2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                Master Admin
              </span>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {isPublic && (
            <>
              <button
                onClick={() => handleNav('/')}
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

          {isStudent && (
            <>
              <button
                onClick={() => handleNav('/student')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Dashboard
              </button>
              <button
                onClick={() => handleNav('/student/browse')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Browse Items
              </button>
              <button
                onClick={() => handleNav('/student/report-lost')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Report Lost Item
              </button>
              <button
                onClick={() => handleNav('/student/report-found')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Report Found Item
              </button>
              <button
                onClick={() => handleNav('/student/activity')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                My Activity
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
            </>
          )}

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
                Pending Reports
              </button>
              <button
                onClick={() => handleNav('/admin/claims')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Pending Claims
              </button>
              <button
                onClick={() => handleNav('/admin/students')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Registered Students
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
            </>
          )}

          {isOwner && (
            <>
              <button
                onClick={() => handleNav('/owner')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Owner Dashboard
              </button>
              <button
                onClick={() => handleNav('/owner/colleges')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Colleges
              </button>
              <button
                onClick={() => handleNav('/owner/admin-requests')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Admin Requests
              </button>
              <button
                onClick={() => handleNav('/owner/admins')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                College Admins
              </button>
              <button
                onClick={() => handleNav('/owner/activity')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Platform Activity
              </button>
            </>
          )}
        </div>
      )}

      {/* Pilot Feedback Modal */}
      <PilotFeedbackModal 
        isOpen={isFeedbackModalOpen} 
        onClose={() => setIsFeedbackModalOpen(false)} 
      />
    </header>
  );
};
