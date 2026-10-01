import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  FileText, 
  CheckSquare, 
  RotateCcw, 
  TrendingUp, 
  Download, 
  ShieldCheck, 
  Info,
  BarChart3,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { College } from '../../types';

interface CollegeSummaryMetric {
  collegeId: string;
  collegeName: string;
  code: string;
  domain?: string;
  studentCount: number;
  lostCount: number;
  foundCount: number;
  claimsCount: number;
  returnedCount: number;
  closureRate: string;
}

export const OwnerAnalyticsPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);

  // Platform-wide counts
  const [platformStats, setPlatformStats] = useState({
    totalColleges: 0,
    activeColleges: 0,
    totalStudents: 0,
    totalLost: 0,
    totalFound: 0,
    totalClaims: 0,
    totalReturns: 0,
    totalClosed: 0
  });

  const [collegeSummaries, setCollegeSummaries] = useState<CollegeSummaryMetric[]>([]);

  useEffect(() => {
    async function loadPlatformAnalytics() {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch colleges
        const { data: collegesData, error: colErr } = await supabase
          .from('colleges')
          .select('*')
          .order('name', { ascending: true });

        if (colErr) throw colErr;
        const colleges: College[] = collegesData || [];

        // 2. Fetch profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, college_id, role');

        // 3. Fetch items
        const { data: itemsData } = await supabase
          .from('items')
          .select('id, college_id, type, status');

        // 4. Fetch claims
        const { data: claimsData } = await supabase
          .from('claims')
          .select('id, college_id, status');

        const profiles = profilesData || [];
        const items = itemsData || [];
        const claims = claimsData || [];

        // Compute overall platform totals
        const students = profiles.filter((p) => p.role === 'student' || p.role === 'STUDENT');
        const lost = items.filter((i) => i.type === 'LOST');
        const found = items.filter((i) => i.type === 'FOUND');
        const returns = items.filter((i) => ['returned', 'RETURNED'].includes(i.status));
        const closed = items.filter((i) => ['returned', 'RETURNED', 'closed', 'CLOSED', 'rejected', 'REJECTED'].includes(i.status));

        // Compute college breakdown
        const summaries: CollegeSummaryMetric[] = colleges.map((col) => {
          const colStudents = students.filter((p) => p.college_id === col.id).length;
          const colItems = items.filter((i) => i.college_id === col.id);
          const colLost = colItems.filter((i) => i.type === 'LOST').length;
          const colFound = colItems.filter((i) => i.type === 'FOUND').length;
          const colClaims = claims.filter((c) => c.college_id === col.id).length;
          const colReturned = colItems.filter((i) => ['returned', 'RETURNED'].includes(i.status)).length;
          const colClosed = colItems.filter((i) => ['returned', 'RETURNED', 'closed', 'CLOSED', 'rejected', 'REJECTED'].includes(i.status)).length;

          let closureRate = '0%';
          if (colItems.length > 0) {
            closureRate = `${Math.round((colClosed / colItems.length) * 100)}%`;
          }

          return {
            collegeId: col.id,
            collegeName: col.name,
            code: col.code,
            domain: col.domain,
            studentCount: colStudents,
            lostCount: colLost,
            foundCount: colFound,
            claimsCount: colClaims,
            returnedCount: colReturned,
            closureRate
          };
        });

        // Count active colleges (colleges with students, items, or claims)
        const activeCollegesCount = summaries.filter(
          (s) => s.studentCount > 0 || s.lostCount > 0 || s.foundCount > 0 || s.claimsCount > 0
        ).length;

        setPlatformStats({
          totalColleges: colleges.length,
          activeColleges: activeCollegesCount,
          totalStudents: students.length,
          totalLost: lost.length,
          totalFound: found.length,
          totalClaims: claims.length,
          totalReturns: returns.length,
          totalClosed: closed.length
        });

        setCollegeSummaries(summaries);
      } catch (err: any) {
        console.error('Error loading platform owner analytics:', err);
        showToast({
          type: 'error',
          title: 'Platform Analytics Error',
          message: err.message || 'Failed to load cross-college analytics.'
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadPlatformAnalytics();
  }, []);

  const handleExportCSV = () => {
    if (collegeSummaries.length === 0) {
      showToast({
        type: 'error',
        title: 'Export Unavailable',
        message: 'No college summary metrics available to export.'
      });
      return;
    }

    const headers = [
      'College Name',
      'College Code',
      'Domain',
      'Registered Students',
      'Lost Reports',
      'Found Reports',
      'Submitted Claims',
      'Returned Items',
      'Case Closure Rate'
    ];

    const rows = collegeSummaries.map((s) => [
      `"${s.collegeName.replace(/"/g, '""')}"`,
      `"${s.code}"`,
      `"${s.domain || ''}"`,
      s.studentCount,
      s.lostCount,
      s.foundCount,
      s.claimsCount,
      s.returnedCount,
      `"${s.closureRate}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foundly_platform_owner_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: 'success',
      title: 'Platform Export Complete',
      message: `Exported summary statistics for ${collegeSummaries.length} colleges.`
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Fetching platform-wide analytics & college telemetry..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in" id="owner-analytics-root">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Foundly Platform Owner Console
            </span>
            <span className="text-xs text-slate-400 font-medium">Cross-Institution Telemetry</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Global Platform Analytics & Summary
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor network-wide user engagement, total resolution volumes, and per-college operational summaries
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          leftIcon={<Download className="w-4 h-4 text-purple-600" />}
        >
          Export Platform CSV
        </Button>
      </div>

      {/* Global Platform Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <DashboardCard
          title="Total Colleges"
          value={String(platformStats.totalColleges)}
          subtitle={`${platformStats.activeColleges} active campuses`}
          icon={<Building2 className="w-4 h-4 text-indigo-600" />}
        />

        <DashboardCard
          title="Total Registered Students"
          value={String(platformStats.totalStudents)}
          subtitle="Across all campus domains"
          icon={<Users className="w-4 h-4 text-emerald-600" />}
        />

        <DashboardCard
          title="Total Lost Reports"
          value={String(platformStats.totalLost)}
          subtitle="Platform-wide submissions"
          icon={<FileText className="w-4 h-4 text-amber-600" />}
        />

        <DashboardCard
          title="Total Found Reports"
          value={String(platformStats.totalFound)}
          subtitle="Found items logged"
          icon={<FileText className="w-4 h-4 text-indigo-600" />}
        />

        <DashboardCard
          title="Total Student Claims"
          value={String(platformStats.totalClaims)}
          subtitle="Claims filed globally"
          icon={<CheckSquare className="w-4 h-4 text-blue-600" />}
        />

        <DashboardCard
          title="Total Items Returned"
          value={String(platformStats.totalReturns)}
          subtitle="Successful recoveries"
          icon={<RotateCcw className="w-4 h-4 text-emerald-600" />}
        />

        <DashboardCard
          title="Total Closed Cases"
          value={String(platformStats.totalClosed)}
          subtitle="Resolved or archived cases"
          icon={<BarChart3 className="w-4 h-4 text-purple-600" />}
        />

        <DashboardCard
          title="Active Campuses"
          value={String(platformStats.activeColleges)}
          subtitle="With live lost/found data"
          icon={<ShieldCheck className="w-4 h-4 text-indigo-600" />}
        />
      </div>

      {/* Per-College Factual Summary Table */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              College Operational Summaries
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Objective Factual Telemetry</span>
        </div>

        {collegeSummaries.length === 0 ? (
          <EmptyState
            title="No colleges registered"
            description="Onboarded colleges will appear in this platform-wide comparative summary table."
            icon={<Building2 className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-3 px-3">College</th>
                  <th className="pb-3 px-3">Code</th>
                  <th className="pb-3 px-3">Students</th>
                  <th className="pb-3 px-3">Lost</th>
                  <th className="pb-3 px-3">Found</th>
                  <th className="pb-3 px-3">Claims</th>
                  <th className="pb-3 px-3">Returned</th>
                  <th className="pb-3 px-3">Closure Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collegeSummaries.map((summary) => (
                  <tr key={summary.collegeId} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-3 font-semibold text-slate-900">
                      <div>
                        <p>{summary.collegeName}</p>
                        {summary.domain && (
                          <p className="text-[10px] text-slate-400 font-normal">{summary.domain}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 font-medium">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                        {summary.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 font-medium">{summary.studentCount}</td>
                    <td className="py-3.5 px-3 text-amber-700 font-medium">{summary.lostCount}</td>
                    <td className="py-3.5 px-3 text-indigo-700 font-medium">{summary.foundCount}</td>
                    <td className="py-3.5 px-3 text-blue-700 font-medium">{summary.claimsCount}</td>
                    <td className="py-3.5 px-3 text-emerald-700 font-semibold">{summary.returnedCount}</td>
                    <td className="py-3.5 px-3 text-purple-700 font-bold">{summary.closureRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guidelines Note */}
      <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Fair Telemetry Principle:</span> College comparison tables display objective, raw operational metrics. Colleges are never ranked or tagged with subjective badges.
        </div>
      </div>
    </div>
  );
};
