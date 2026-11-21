import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  RotateCcw,
  FileText,
  CheckSquare,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Item, Claim, CATEGORIES, ItemCategory } from '../../types';

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface CategoryMetric {
  category: ItemCategory;
  count: number;
  percentage: number;
}

interface LocationMetric {
  location: string;
  count: number;
  percentage: number;
}

interface TrendBucket {
  label: string;
  lost: number;
  found: number;
  claims: number;
  returned: number;
}

export const AdminAnalyticsPage: React.FC = () => {
  const { profile, session, configuredCollege } = useAuth();
  const { showToast } = useToast();

  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [collegeItems, setCollegeItems] = useState<Item[]>([]);

  const [metrics, setMetrics] = useState({
    totalLost: 0,
    totalFound: 0,
    totalClaims: 0,
    verifiedClaims: 0,
    itemsReturned: 0,
    closedCases: 0,
    activeCases: 0,
    claimVerificationRate: '—',
    returnRate: '—',
    caseClosureRate: '—',
    avgResolutionTime: '—',
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryMetric[]>([]);
  const [locationBreakdown, setLocationBreakdown] = useState<LocationMetric[]>([]);
  const [trendBuckets, setTrendBuckets] = useState<TrendBucket[]>([]);

  const targetCollegeId = profile?.college_id || configuredCollege?.id;

  useEffect(() => {
    async function fetchCollegeAnalytics() {
      if (!targetCollegeId || !isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('items')
          .select('*')
          .eq('college_id', targetCollegeId)
          .order('created_at', { ascending: false });

        if (itemsErr) throw itemsErr;

        const { data: claimsData, error: claimsErr } = await supabase
          .from('claims')
          .select('*')
          .eq('college_id', targetCollegeId)
          .order('created_at', { ascending: false });

        if (claimsErr) throw claimsErr;

        const items: Item[] = (itemsData || []).map((i: any) => ({
          ...i,
          type: (i.type || 'LOST').toUpperCase(),
          status: (i.status || 'PENDING').toUpperCase(),
        }));
        const claims: Claim[] = (claimsData || []).map((c: any) => ({
          ...c,
          status: (c.status || 'PENDING').toUpperCase(),
        }));

        setCollegeItems(items);
        calculateAnalytics(items, claims, timeRange);
      } catch (err: any) {
        console.error('Error loading college analytics:', err);
        showToast({
          type: 'error',
          title: 'Analytics Load Failed',
          message: err.message || 'Could not compute campus metrics.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchCollegeAnalytics();
  }, [targetCollegeId, timeRange]);

  const calculateAnalytics = (items: Item[], claims: Claim[], range: TimeRange) => {
    const now = new Date();
    let cutoffDate: Date | null = null;
    if (range === '7d') cutoffDate = new Date(now.getTime() - 7 * 86400000);
    else if (range === '30d') cutoffDate = new Date(now.getTime() - 30 * 86400000);
    else if (range === '90d') cutoffDate = new Date(now.getTime() - 90 * 86400000);

    const filteredItems = cutoffDate
      ? items.filter((i) => new Date(i.created_at) >= cutoffDate!)
      : items;
    const filteredClaims = cutoffDate
      ? claims.filter((c) => new Date(c.created_at) >= cutoffDate!)
      : claims;

    const totalLost = filteredItems.filter((i) => i.type === 'LOST').length;
    const totalFound = filteredItems.filter((i) => i.type === 'FOUND').length;
    const totalClaimsCount = filteredClaims.length;

    const verifiedClaims = filteredClaims.filter((c) =>
      ['APPROVED', 'HANDOVER', 'COMPLETED'].includes(c.status)
    ).length;

    const itemsReturned = filteredItems.filter((i) => i.status === 'RETURNED').length;
    const closedCases = filteredItems.filter((i) =>
      ['RETURNED', 'CLOSED', 'REJECTED'].includes(i.status)
    ).length;
    const activeCases = filteredItems.filter((i) =>
      ['PENDING', 'PUBLISHED', 'APPROVED', 'HANDOVER'].includes(i.status)
    ).length;

    const claimVerificationRate =
      totalClaimsCount > 0 ? `${Math.round((verifiedClaims / totalClaimsCount) * 100)}%` : '—';

    const totalReports = filteredItems.length;
    const returnRate =
      totalReports > 0 ? `${Math.round((itemsReturned / totalReports) * 100)}%` : '—';
    const caseClosureRate =
      totalReports > 0 ? `${Math.round((closedCases / totalReports) * 100)}%` : '—';

    let avgResolutionTime = '—';
    const returnedItemsList = filteredItems.filter((i) => i.status === 'RETURNED');
    if (returnedItemsList.length > 0) {
      let totalHours = 0;
      let validCount = 0;
      returnedItemsList.forEach((item) => {
        const createdMs = new Date(item.created_at).getTime();
        const returnedMs = item.returned_at
          ? new Date(item.returned_at).getTime()
          : new Date().getTime();
        if (returnedMs > createdMs) {
          totalHours += (returnedMs - createdMs) / 3600000;
          validCount++;
        }
      });

      if (validCount > 0) {
        const avgHours = totalHours / validCount;
        avgResolutionTime =
          avgHours < 24 ? `${avgHours.toFixed(1)}h` : `${(avgHours / 24).toFixed(1)}d`;
      }
    }

    setMetrics({
      totalLost,
      totalFound,
      totalClaims: totalClaimsCount,
      verifiedClaims,
      itemsReturned,
      closedCases,
      activeCases,
      claimVerificationRate,
      returnRate,
      caseClosureRate,
      avgResolutionTime,
    });

    const categoryMap: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      categoryMap[cat] = 0;
    });
    filteredItems.forEach((item) => {
      if (categoryMap[item.category] !== undefined) categoryMap[item.category]++;
      else categoryMap['OTHER'] = (categoryMap['OTHER'] || 0) + 1;
    });

    setCategoryBreakdown(
      CATEGORIES.map((cat) => {
        const count = categoryMap[cat] || 0;
        const percentage = totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
        return { category: cat, count, percentage };
      }).sort((a, b) => b.count - a.count)
    );

    const locationMap: Record<string, number> = {};
    filteredItems.forEach((item) => {
      if (item.location && item.location.trim()) {
        const cleanedLoc = item.location.trim();
        locationMap[cleanedLoc] = (locationMap[cleanedLoc] || 0) + 1;
      }
    });

    setLocationBreakdown(
      Object.entries(locationMap)
        .map(([location, count]) => ({
          location,
          count,
          percentage: totalReports > 0 ? Math.round((count / totalReports) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    );

    setTrendBuckets(buildTrendBuckets(filteredItems, filteredClaims, range));
  };

  const buildTrendBuckets = (items: Item[], claims: Claim[], range: TimeRange): TrendBucket[] => {
    const now = new Date();
    const result: TrendBucket[] = [];

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
        });

        result.push({
          label: dayLabel,
          lost: items.filter((item) => item.type === 'LOST' && item.created_at.startsWith(dateStr)).length,
          found: items.filter((item) => item.type === 'FOUND' && item.created_at.startsWith(dateStr)).length,
          claims: claims.filter((claim) => claim.created_at.startsWith(dateStr)).length,
          returned: items.filter((item) => item.status === 'RETURNED' && item.created_at.startsWith(dateStr)).length,
        });
      }
    } else if (range === '30d') {
      for (let w = 3; w >= 0; w--) {
        const endW = new Date(now.getTime() - w * 7 * 86400000);
        const startW = new Date(endW.getTime() - 7 * 86400000);
        result.push({
          label: `Week ${4 - w}`,
          lost: items.filter((i) => i.type === 'LOST' && new Date(i.created_at) >= startW && new Date(i.created_at) < endW).length,
          found: items.filter((i) => i.type === 'FOUND' && new Date(i.created_at) >= startW && new Date(i.created_at) < endW).length,
          claims: claims.filter((c) => new Date(c.created_at) >= startW && new Date(c.created_at) < endW).length,
          returned: items.filter((i) => i.status === 'RETURNED' && new Date(i.created_at) >= startW && new Date(i.created_at) < endW).length,
        });
      }
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const year = d.getFullYear();
        const monthIndex = d.getMonth();
        result.push({
          label: `${monthNames[monthIndex]} ${year}`,
          lost: items.filter((i) => {
            const idate = new Date(i.created_at);
            return i.type === 'LOST' && idate.getFullYear() === year && idate.getMonth() === monthIndex;
          }).length,
          found: items.filter((i) => {
            const idate = new Date(i.created_at);
            return i.type === 'FOUND' && idate.getFullYear() === year && idate.getMonth() === monthIndex;
          }).length,
          claims: claims.filter((c) => {
            const cdate = new Date(c.created_at);
            return cdate.getFullYear() === year && cdate.getMonth() === monthIndex;
          }).length,
          returned: items.filter((i) => {
            const idate = new Date(i.created_at);
            return i.status === 'RETURNED' && idate.getFullYear() === year && idate.getMonth() === monthIndex;
          }).length,
        });
      }
    }

    return result;
  };

  const handleExportExcel = async () => {
    if (!session?.access_token) {
      showToast({
        type: 'error',
        title: 'Session Expired',
        message: 'Please sign in again.',
      });
      return;
    }
    setIsExportingExcel(true);
    try {
      const res = await fetch(`/api/admin/export-excel?range=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to generate Excel workbook.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foundly-campus-report-${timeRange}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        type: 'success',
        title: 'Export Downloaded',
        message: 'Excel workbook (.xlsx) saved.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err.message,
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = () => {
    if (collegeItems.length === 0) {
      showToast({
        type: 'error',
        title: 'No Records',
        message: 'No items available to export.',
      });
      return;
    }

    const headers = [
      'Report Reference ID',
      'Item Name',
      'Type',
      'Category',
      'Location',
      'Status',
      'Incident Date',
      'Reported Date',
    ];

    const rows = collegeItems.map((item) => [
      `"${item.id}"`,
      `"${(item.item_name || '').replace(/"/g, '""')}"`,
      `"${item.type}"`,
      `"${item.category || 'OTHER'}"`,
      `"${(item.location || '').replace(/"/g, '""')}"`,
      `"${item.status}"`,
      `"${item.date || ''}"`,
      `"${new Date(item.created_at).toISOString().split('T')[0]}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foundly_campus_reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast({
      type: 'success',
      title: 'CSV Downloaded',
      message: `Exported ${collegeItems.length} records.`,
    });
  };

  if (isLoading) {
    return <LoadingState message="Calculating analytics..." />;
  }

  return (
    <div className="w-full space-y-6 animate-fade-in" id="admin-analytics-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Analytics</h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-36">
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              options={[
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: '90d', label: 'Last 90 days' },
                { value: 'all', label: 'All time' },
              ]}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportExcel}
            isLoading={isExportingExcel}
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* 4 Primary Volume KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <DashboardCard
          title="Lost Reports"
          value={metrics.totalLost}
          icon={<FileText className="w-4 h-4 text-amber-600" />}
        />
        <DashboardCard
          title="Found Reports"
          value={metrics.totalFound}
          icon={<FileText className="w-4 h-4 text-indigo-600" />}
        />
        <DashboardCard
          title="Claims"
          value={metrics.totalClaims}
          icon={<CheckSquare className="w-4 h-4 text-indigo-600" />}
        />
        <DashboardCard
          title="Returned"
          value={metrics.itemsReturned}
          icon={<RotateCcw className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* Recovery & Efficiency Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Verification Rate</p>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {metrics.claimVerificationRate}
          </p>
          <p className="text-xs text-slate-400 mt-1 tabular-nums">
            {metrics.verifiedClaims} / {metrics.totalClaims} claims
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Return Rate</p>
          <p className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {metrics.returnRate}
          </p>
          <p className="text-xs text-slate-400 mt-1 tabular-nums">
            {metrics.itemsReturned} returned
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Closure Rate</p>
          <p className="text-xl font-bold text-indigo-700 mt-1 tabular-nums">
            {metrics.caseClosureRate}
          </p>
          <p className="text-xs text-slate-400 mt-1 tabular-nums">
            {metrics.closedCases} closed · {metrics.activeCases} active
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Avg Resolution</p>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {metrics.avgResolutionTime}
          </p>
          <p className="text-xs text-slate-400 mt-1">Report to return</p>
        </div>
      </div>

      {/* Trend Table */}
      <section className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Trends</h2>
          <span className="text-xs text-slate-400">
            {timeRange === '7d'
              ? 'Daily'
              : timeRange === '30d'
              ? 'Weekly'
              : 'Monthly'}
          </span>
        </div>

        {trendBuckets.length === 0 ? (
          <EmptyState
            className="border-0 rounded-none py-8"
            title="No trend data"
            icon={<BarChart3 className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-4 text-right">Lost</th>
                  <th className="py-2.5 px-4 text-right">Found</th>
                  <th className="py-2.5 px-4 text-right">Claims</th>
                  <th className="py-2.5 px-4 text-right">Returned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 tabular-nums">
                {trendBuckets.map((bucket, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{bucket.label}</td>
                    <td className="py-2.5 px-4 text-right">{bucket.lost}</td>
                    <td className="py-2.5 px-4 text-right">{bucket.found}</td>
                    <td className="py-2.5 px-4 text-right">{bucket.claims}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-emerald-700">
                      {bucket.returned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Categories & Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Categories</h2>

          {categoryBreakdown.filter((c) => c.count > 0).length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No items in this period.</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown
                .filter((c) => c.count > 0)
                .map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {cat.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(cat.percentage, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Top Locations</h2>

          {locationBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No location data yet.</p>
          ) : (
            <div className="space-y-3">
              {locationBreakdown.map((loc) => (
                <div key={loc.location} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800 truncate">{loc.location}</span>
                    <span className="text-slate-500 tabular-nums shrink-0">
                      {loc.count} ({loc.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-slate-700 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(loc.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
