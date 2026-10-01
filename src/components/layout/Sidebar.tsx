import React from 'react';
import { 
  Home, 
  Search, 
  PlusCircle, 
  Clock, 
  Bell, 
  User, 
  FileText, 
  CheckSquare, 
  Users, 
  Building, 
  ShieldCheck, 
  Activity,
  BarChart3,
  LogOut,
  BookOpen
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';

export interface SidebarProps {
  role?: 'STUDENT' | 'COLLEGE_ADMIN' | 'FOUNDLY_OWNER';
}

export const Sidebar: React.FC<SidebarProps> = ({ role }) => {
  const { currentPath, navigate } = useRouter();
  const { user, role: authRole, signOut } = useAuth();

  // Prefer verified database role from Supabase, or current path context
  const isOwner = authRole === 'foundly_owner' || currentPath.startsWith('/owner');
  const isAdmin = authRole === 'college_admin' || currentPath.startsWith('/admin');
  const isStudent = !isAdmin && !isOwner;

  const studentLinks = [
    { label: 'Home', path: '/student', icon: <Home className="w-4 h-4" /> },
    { label: 'Find an Item', path: '/student/browse', icon: <Search className="w-4 h-4" /> },
    { label: 'Report Lost', path: '/student/report-lost', icon: <PlusCircle className="w-4 h-4 text-amber-500" /> },
    { label: 'Report Found', path: '/student/report-found', icon: <PlusCircle className="w-4 h-4 text-emerald-500" /> },
    { label: 'My Reports', path: '/student/activity', icon: <FileText className="w-4 h-4" /> },
    { label: 'My Claims', path: '/student/activity', icon: <CheckSquare className="w-4 h-4" /> },
    { label: 'Notifications', path: '/student/notifications', icon: <Bell className="w-4 h-4" /> },
    { label: 'Profile', path: '/student/profile', icon: <User className="w-4 h-4" /> },
  ];

  const adminLinks = [
    { label: 'Admin Dashboard', path: '/admin', icon: <Home className="w-4 h-4" /> },
    { label: 'Items', path: '/admin/reports', icon: <Search className="w-4 h-4" /> },
    { label: 'Reports', path: '/admin/reports', icon: <FileText className="w-4 h-4" /> },
    { label: 'Claims', path: '/admin/claims', icon: <CheckSquare className="w-4 h-4" /> },
    { label: 'Verification', path: '/admin/students', icon: <ShieldCheck className="w-4 h-4" /> },
    { label: 'Notifications', path: '/admin/notifications', icon: <Bell className="w-4 h-4" /> },
    { label: 'Profile', path: '/admin/profile', icon: <User className="w-4 h-4" /> },
  ];

  // Owner Portal links (only accessible when in the separate Owner Portal at /owner/*)
  const ownerLinks = [
    { label: 'Dashboard', path: '/owner', icon: <Home className="w-4 h-4" /> },
    { label: 'Colleges', path: '/owner/colleges', icon: <Building className="w-4 h-4" /> },
    { label: 'Admin Requests', path: '/owner/admin-requests', icon: <ShieldCheck className="w-4 h-4" /> },
    { label: 'Approved Admins', path: '/owner/admins', icon: <Users className="w-4 h-4" /> },
    { label: 'Platform Analytics', path: '/owner/analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Activity Logs', path: '/owner/activity', icon: <Activity className="w-4 h-4" /> },
  ];

  const links = isStudent ? studentLinks : isAdmin ? adminLinks : ownerLinks;

  const handleSignOut = async () => {
    if (user) {
      await signOut();
    }
    navigate('/');
  };

  return (
    <div className="flex flex-col w-full rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div className="space-y-4">
        <div>
          <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {isStudent ? 'Student Portal' : isAdmin ? 'College Admin Portal' : 'Owner Portal'}
          </p>
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {links.map((link) => {
              const isActive = currentPath === link.path || (link.path !== '/student' && link.path !== '/admin' && link.path !== '/owner' && currentPath.startsWith(link.path));
              return (
                <button
                  key={link.label}
                  onClick={() => navigate(link.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
