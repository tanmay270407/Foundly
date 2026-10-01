import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { 
  Building2, 
  ShieldCheck, 
  Users, 
  Activity, 
  ArrowRight,
  UserCheck,
  Calendar,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { parseAdminRequest } from '../../lib/adminRequests';

export const OwnerDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const [stats, setStats] = useState({
    colleges: 0,
    adminRequests: 0,
    approvedAdmins: 0,
    activityCount: 0
  });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // 1. Fetch colleges count
        const { count: collegesCount } = await supabase
          .from('colleges')
          .select('*', { count: 'exact', head: true });

        // 2. Fetch pending requests list + count
        const { data: requestsData, count: pendingCount } = await supabase
          .from('admin_requests')
          .select('*, colleges(*)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        // 3. Fetch approved college admins count
        const { count: adminsCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'college_admin');

        // 4. Fetch activity logs count
        const { count: totalLogsCount } = await supabase
          .from('activity_logs')
          .select('*', { count: 'exact', head: true });

        // 5. Fetch recent activity logs
        const { data: logsData } = await supabase
          .from('activity_logs')
          .select('*, colleges(*)')
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          colleges: collegesCount || 0,
          adminRequests: pendingCount || 0,
          approvedAdmins: adminsCount || 0,
          activityCount: totalLogsCount || 0
        });

        if (requestsData) setPendingRequests(requestsData);
        if (logsData) setRecentLogs(logsData);

      } catch (err) {
        console.error('Failed to load platform owner dashboard statistics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Connecting to platform directory..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in" id="owner-dashboard-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Foundly Platform Owner Console
            </span>
            <span className="text-xs text-slate-400 font-medium">Multi-College Master</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Global Platform Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervise onboarding colleges, verify campus administrator applications, and monitor cross-institution activity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/owner/health')}
            leftIcon={<Activity className="w-4 h-4 text-emerald-600" />}
          >
            System Health
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/owner/analytics')}
            leftIcon={<BarChart3 className="w-4 h-4 text-purple-600" />}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/owner/colleges')}
            leftIcon={<Building2 className="w-4 h-4" />}
          >
            Colleges
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/owner/admin-requests')}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Admin Requests ({stats.adminRequests})
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Onboarded Colleges"
          value={String(stats.colleges)}
          subtitle="Active campus domains"
          icon={<Building2 className="w-5 h-5 text-indigo-600" />}
          onClick={() => navigate('/owner/colleges')}
        />

        <DashboardCard
          title="Admin Requests"
          value={String(stats.adminRequests)}
          subtitle="Pending Owner review"
          icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
          onClick={() => navigate('/owner/admin-requests')}
        />

        <DashboardCard
          title="Approved Admins"
          value={String(stats.approvedAdmins)}
          subtitle="Active campus operators"
          icon={<Users className="w-5 h-5 text-emerald-600" />}
          onClick={() => navigate('/owner/admins')}
        />

        <DashboardCard
          title="Platform Activity"
          value={String(stats.activityCount)}
          subtitle="Events recorded globally"
          icon={<Activity className="w-5 h-5 text-purple-600" />}
          onClick={() => navigate('/owner/activity')}
        />
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending College Admin Requests */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>Admin Requests ({pendingRequests.length})</span>
              </h2>
              {pendingRequests.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/owner/admin-requests')}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Review
                </Button>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <EmptyState
                title="No pending admin applications"
                description="Staff applications from /admin-application queue here. Only the Foundly Owner can authorize College Admin credentials."
                icon={<ShieldCheck className="w-6 h-6 text-slate-400" />}
              />
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-xs truncate">{req.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{req.email}</p>
                      <p className="text-[10px] text-indigo-600 font-medium truncate mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        <span>{req.colleges?.name || parseAdminRequest(req).extractedCollegeName || 'Pending Campus'}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/owner/admin-requests')}
                      rightIcon={<ArrowRight className="w-3 h-3" />}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Global Platform Activity */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                <span>Recent Global Telemetry</span>
              </h2>
              {recentLogs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/owner/activity')}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  View all
                </Button>
              )}
            </div>

            {recentLogs.length === 0 ? (
              <EmptyState
                title="No platform activity logs"
                description="Real-time audit trails for new item publications, claims, and confirmed handovers across all colleges will appear here."
                icon={<Activity className="w-6 h-6 text-slate-400" />}
              />
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl border border-slate-50 bg-white/50 flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-xl bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800">
                        {log.action?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        Entity: {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {log.colleges?.name || 'System'}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
