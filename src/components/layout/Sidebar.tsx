import React from 'react';
import {
  Home,
  Search,
  PlusCircle,
  Bell,
  User,
  FileText,
  CheckSquare,
  Users,
  ShieldCheck,
  Activity,
  BarChart3,
  LogOut,
  HelpCircle,
  Package,
  PackageCheck,
  FileSpreadsheet,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';

export interface SidebarProps {
  role?: 'STUDENT' | 'COLLEGE_ADMIN';
}

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const { currentPath, navigate } = useRouter();
  const { user, role: authRole, signOut } = useAuth();

  const isAdmin = authRole === 'college_admin' || currentPath.startsWith('/admin');

  const studentSections: SidebarSection[] = [
    {
      items: [
        { label: 'Home', path: '/student', icon: <Home className="w-4 h-4" /> },
        { label: 'Browse Items', path: '/student/browse', icon: <Search className="w-4 h-4" /> },
        { label: 'Report Lost', path: '/student/report-lost', icon: <AlertTriangle className="w-4 h-4" /> },
        { label: 'Report Found', path: '/student/report-found', icon: <PlusCircle className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Activity',
      items: [
        { label: 'My Reports', path: '/student/reports', icon: <FileText className="w-4 h-4" /> },
        { label: 'My Claims', path: '/student/claims', icon: <CheckSquare className="w-4 h-4" /> },
        { label: 'Notifications', path: '/student/notifications', icon: <Bell className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', path: '/student/profile', icon: <User className="w-4 h-4" /> },
        { label: 'Help', path: '/help', icon: <HelpCircle className="w-4 h-4" /> },
      ],
    },
  ];

  const adminSections: SidebarSection[] = [
    {
      items: [
        { label: 'Overview', path: '/admin', icon: <Home className="w-4 h-4" /> },
        { label: 'Lost Reports', path: '/admin/lost-reports', icon: <AlertTriangle className="w-4 h-4" /> },
        { label: 'Found Reports', path: '/admin/found-reports', icon: <Package className="w-4 h-4" /> },
        { label: 'Matches', path: '/admin/matches', icon: <Sparkles className="w-4 h-4" /> },
        { label: 'All Items', path: '/admin/items', icon: <Search className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Claims',
      items: [
        { label: 'All Claims', path: '/admin/claims', icon: <CheckSquare className="w-4 h-4" /> },
        { label: 'Verification', path: '/admin/verification', icon: <ShieldCheck className="w-4 h-4" /> },
        { label: 'Handover', path: '/admin/handover', icon: <PackageCheck className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Management',
      items: [
        { label: 'Students', path: '/admin/students', icon: <Users className="w-4 h-4" /> },
        { label: 'Analytics', path: '/admin/analytics', icon: <BarChart3 className="w-4 h-4" /> },
        { label: 'Export', path: '/admin/export', icon: <FileSpreadsheet className="w-4 h-4" /> },
        { label: 'Activity Logs', path: '/admin/activity-logs', icon: <Activity className="w-4 h-4" /> },
        { label: 'Settings', path: '/admin/profile', icon: <User className="w-4 h-4" /> },
      ],
    },
  ];

  const sections = isAdmin ? adminSections : studentSections;

  const handleSignOut = async () => {
    if (user) {
      await signOut();
    }
    navigate('/');
  };

  return (
    <div className="hidden lg:flex flex-col sticky top-20 w-full">
      <nav className="space-y-5" aria-label={isAdmin ? 'Admin navigation' : 'Student navigation'}>
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-0.5">
            {section.title && (
              <p className="px-2.5 pb-1 text-[11px] font-medium text-slate-400">
                {section.title}
              </p>
            )}
            {section.items.map((link) => {
              const isActive =
                currentPath === link.path ||
                (link.path !== '/student' &&
                  link.path !== '/admin' &&
                  currentPath.startsWith(link.path + '/'));
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                    isActive
                      ? 'bg-indigo-50/90 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                    {link.icon}
                  </span>
                  <span className="truncate">{link.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="pt-4 mt-5 border-t border-slate-200/70">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors duration-150"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
};
