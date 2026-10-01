import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  MapPin, 
  Download, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  RotateCcw, 
  FileText, 
  CheckSquare, 
  Info,
  Building2,
  Inbox
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
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isLoading, setIsLoading] = useState(true);

  // Raw data collections for active college
  const [collegeItems, setCollegeItems] = useState<Item[]>([]);
  const [collegeClaims, setCollegeClaims] = useState<Claim[]>([]);

  // Computed Key Metrics
  const [metrics, setMetrics] = useState({
    totalLost: 0,
    totalFound: 0,
    totalClaims: 0,
    verifiedClaims: 0,
    itemsReturned: 0,
    closedCases: 0,
    activeCases: 0,
    // Recovery Rates
    claimVerificationRate: 'Not enough data',
    returnRate: 'Not enough data',
    caseClosureRate: 'Not enough data',
    avgResolutionTime: 'Not enough data'
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryMetric[]>([]);
  const [locationBreakdown, setLocationBreakdown] = useState<LocationMetric[]>([]);
  const [trendBuckets, setTrendBuckets] = useState<TrendBucket[]>([]);

  useEffect(() => {
    async function fetchCollegeAnalytics() {
      if (!profile?.college_id || !isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch all items for this college (scoped by RLS & college_id)
        const { data: itemsData, error: itemsErr } = await supabase
          .from('items')
          .select('*')
          .eq('college_id', profile.college_id)
          .order('created_at', { ascending: false });

        if (itemsErr) throw itemsErr;

        // 2. Fetch all claims for this college
        const { data: claimsData, error: claimsErr } = await supabase
          .from('claims')
          .select('*')
          .eq('college_id', profile.college_id)
          .order('created_at', { ascending: false });

        if (claimsErr) throw claimsErr;

        const items: Item[] = itemsData || [];
        const claims: Claim[] = claimsData || [];

        setCollegeItems(items);
        setCollegeClaims(claims);

        calculateAnalytics(items, claims, timeRange);
      } catch (err: any) {
        console.error('Error loading college analytics:', err);
        showToast({
          type: 'error',
          title: 'Analytics Load Failed',
          message: err.message || 'Could not compute campus impact telemetry.'
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchCollegeAnalytics();
  }, [profile?.college_id, timeRange]);

  const calculateAnalytics = (items: Item[], claims: Claim[], range: TimeRange) => {
    // Determine cutoff date for filtering trends / metrics if timeRange is set
    const now = new Date();
    let cutoffDate: Date | null = null;
    if (range === '7d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30d') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '90d') {
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const filteredItems = cutoffDate
      ? items.filter((i) => new Date(i.created_at) >= cutoffDate!)
      : items;

    const filteredClaims = cutoffDate
      ? claims.filter((c) => new Date(c.created_at) >= cutoffDate!)
      : claims;

    // Overview Counts
    const totalLost = filteredItems.filter((i) => i.type === 'LOST').length;
    const totalFound = filteredItems.filter((i) => i.type === 'FOUND').length;
    const totalClaimsCount = filteredClaims.length;

    // Verified claims: status in ('approved', 'APPROVED', 'handover', 'HANDOVER', 'completed', 'COMPLETED')
    const verifiedClaims = filteredClaims.filter((c) =>
      ['approved', 'APPROVED', 'handover', 'HANDOVER', 'completed', 'COMPLETED'].includes(c.status)
    ).length;

    // Returned items: items with status 'returned' or 'RETURNED'
    const itemsReturned = filteredItems.filter((i) =>
      ['returned', 'RETURNED'].includes(i.status)
    ).length;

    // Closed cases: status in ('returned', 'RETURNED', 'closed', 'CLOSED', 'rejected', 'REJECTED')
    const closedCases = filteredItems.filter((i) =>
      ['returned', 'RETURNED', 'closed', 'CLOSED', 'rejected', 'REJECTED'].includes(i.status)
    ).length;

    // Active cases: status in ('pending', 'PENDING', 'published', 'PUBLISHED', 'approved', 'APPROVED')
    const activeCases = filteredItems.filter((i) =>
      ['pending', 'PENDING', 'published', 'PUBLISHED', 'approved', 'APPROVED'].includes(i.status)
    ).length;

    // Recovery Metrics Calculations (Real timestamps only, no fake data)
    let claimVerificationRate = 'Not enough data';
    if (totalClaimsCount > 0) {
      const pct = Math.round((verifiedClaims / totalClaimsCount) * 100);
      claimVerificationRate = `${pct}%`;
    }

    let returnRate = 'Not enough data';
    const totalReports = filteredItems.length;
    if (totalReports > 0) {
      const pct = Math.round((itemsReturned / totalReports) * 100);
      returnRate = `${pct}%`;
    }

    let caseClosureRate = 'Not enough data';
    if (totalReports > 0) {
      const pct = Math.round((closedCases / totalReports) * 100);
      caseClosureRate = `${pct}%`;
    }

    // Average time to resolution (for returned items with timestamps)
    let avgResolutionTime = 'Not enough data';
    const returnedItemsList = filteredItems.filter(
      (i) => ['returned', 'RETURNED'].includes(i.status)
    );

    if (returnedItemsList.length > 0) {
      let totalHours = 0;
      let validCount = 0;

      returnedItemsList.forEach((item) => {
        const createdMs = new Date(item.created_at).getTime();
        const returnedMs = item.returned_at
          ? new Date(item.returned_at).getTime()
          : new Date().getTime();
        if (returnedMs > createdMs) {
          totalHours += (returnedMs - createdMs) / (1000 * 60 * 60);
          validCount++;
        }
      });

      if (validCount > 0) {
        const avgHours = totalHours / validCount;
        if (avgHours < 24) {
          avgResolutionTime = `${avgHours.toFixed(1)} hrs`;
        } else {
          const avgDays = avgHours / 24;
          avgResolutionTime = `${avgDays.toFixed(1)} days`;
        }
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
      avgResolutionTime
    });

    // Category Breakdown Computation
    const categoryMap: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      categoryMap[cat] = 0;
    });

    filteredItems.forEach((item) => {
      if (categoryMap[item.category] !== undefined) {
        categoryMap[item.category]++;
      } else {
        categoryMap['OTHER'] = (categoryMap['OTHER'] || 0) + 1;
      }
    });

    const categoryList: CategoryMetric[] = CATEGORIES.map((cat) => {
      const count = categoryMap[cat] || 0;
      const percentage = totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
      return { category: cat, count, percentage };
    }).sort((a, b) => b.count - a.count);

    setCategoryBreakdown(categoryList);

    // Location Insights Computation (Aggregate presentation only)
    const locationMap: Record<string, number> = {};
    filteredItems.forEach((item) => {
      if (item.location && item.location.trim()) {
        const cleanedLoc = item.location.trim();
        locationMap[cleanedLoc] = (locationMap[cleanedLoc] || 0) + 1;
      }
    });

    const locationList: LocationMetric[] = Object.entries(locationMap)
      .map(([location, count]) => ({
        location,
        count,
        percentage: totalReports > 0 ? Math.round((count / totalReports) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    setLocationBreakdown(locationList);

    // Trend Buckets Computation
    const buckets: TrendBucket[] = buildTrendBuckets(filteredItems, filteredClaims, range);
    setTrendBuckets(buckets);
  };

  const buildTrendBuckets = (items: Item[], claims: Claim[], range: TimeRange): TrendBucket[] => {
    // Generate buckets depending on selected time range
    const now = new Date();
    const result: TrendBucket[] = [];

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

        const lost = items.filter((item) => item.type === 'LOST' && item.created_at.startsWith(dateStr)).length;
        const found = items.filter((item) => item.type === 'FOUND' && item.created_at.startsWith(dateStr)).length;
        const clm = claims.filter((claim) => claim.created_at.startsWith(dateStr)).length;
        const ret = items.filter((item) => ['returned', 'RETURNED'].includes(item.status) && item.created_at.startsWith(dateStr)).length;

        result.push({ label: dayLabel, lost, found, claims: clm, returned: ret });
      }
    } else if (range === '30d') {
      // 4 Weekly buckets
      for (let w = 3; w >= 0; w--) {
        const endW = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
        const startW = new Date(endW.getTime() - 7 * 24 * 60 * 60 * 1000);
        const label = `Week ${4 - w}`;

        const lost = items.filter((i) => i.type === 'LOST' && new Date(i.created_at) >= startW && new Date(i.created_at) < endW).length;
        const found = items.filter((i) => i.type === 'FOUND' && new Date(i.created_at) >= startW && new Date(i.created_at) < endW).length;
        const clm = claims.filter((c) => new Date(c.created_at) >= startW && new Date(c.created_at) < endW).length;
        const ret = items.filter((i) => ['returned', 'RETURNED'].includes(i.status) && new Date(i.created_at) >= startW && new Date(i.created_at) < endW).length;

        result.push({ label, lost, found, claims: clm, returned: ret });
      }
    } else {
      // Monthly buckets
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const year = d.getFullYear();
        const monthIndex = d.getMonth();
        const label = `${monthNames[monthIndex]} ${year}`;

        const lost = items.filter((i) => {
          const idate = new Date(i.created_at);
          return i.type === 'LOST' && idate.getFullYear() === year && idate.getMonth() === monthIndex;
        }).length;

        const found = items.filter((i) => {
          const idate = new Date(i.created_at);
          return i.type === 'FOUND' && idate.getFullYear() === year && idate.getMonth() === monthIndex;
        }).length;

        const clm = claims.filter((c) => {
          const cdate = new Date(c.created_at);
          return cdate.getFullYear() === year && cdate.getMonth() === monthIndex;
        }).length;

        const ret = items.filter((i) => {
          const idate = new Date(i.created_at);
          return ['returned', 'RETURNED'].includes(i.status) && idate.getFullYear() === year && idate.getMonth() === monthIndex;
        }).length;

        result.push({ label, lost, found, claims: clm, returned: ret });
      }
    }

    return result;
  };

  // CSV Export Function (Aggregate safe data only, strictly excludes student phones/emails/proofs)
  const handleExportCSV = () => {
    if (collegeItems.length === 0) {
      showToast({
        type: 'error',
        title: 'Export Unavailable',
        message: 'No records available to export for this college.'
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
      'Reported Date'
    ];

    const rows = collegeItems.map((item) => [
      `"${item.id}"`,
      `"${item.item_name.replace(/"/g, '""')}"`,
      `"${item.type}"`,
      `"${item.category}"`,
      `"${item.location.replace(/"/g, '""')}"`,
      `"${item.status}"`,
      `"${item.date}"`,
      `"${new Date(item.created_at).toISOString().split('T')[0]}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foundly_college_reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: 'success',
      title: 'Export Complete',
      message: `Exported ${collegeItems.length} report records to CSV.`
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Calculating campus recovery metrics & trend data..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in" id="admin-analytics-root">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              Campus Analytics & Impact
            </span>
            <span className="text-xs text-slate-400 font-medium">Real Backend Telemetry</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Lost & Found Operational Insights
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor recovery rates, campus incident hot-spots, and category distributions for your institution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            options={[
              { value: '7d', label: 'Last 7 Days' },
              { value: '30d', label: 'Last 30 Days' },
              { value: '90d', label: 'Last 90 Days' },
              { value: 'all', label: 'All Time' }
            ]}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-indigo-600" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Primary Volume Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <DashboardCard
          title="Total Lost Reports"
          value={String(metrics.totalLost)}
          subtitle="Lost items reported on campus"
          icon={<FileText className="w-4 h-4 text-amber-600" />}
        />
        <DashboardCard
          title="Total Found Reports"
          value={String(metrics.totalFound)}
          subtitle="Found items logged in storage"
          icon={<FileText className="w-4 h-4 text-indigo-600" />}
        />
        <DashboardCard
          title="Total Student Claims"
          value={String(metrics.totalClaims)}
          subtitle="Ownership claims submitted"
          icon={<CheckSquare className="w-4 h-4 text-blue-600" />}
        />
        <DashboardCard
          title="Items Returned"
          value={String(metrics.itemsReturned)}
          subtitle="Successful campus handovers"
          icon={<RotateCcw className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* Calculated Recovery Metrics (Operational Impact) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Calculated Recovery & Efficiency Metrics
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Real Database Timestamps</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/80">
            <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">Claim Verification Rate</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">{metrics.claimVerificationRate}</p>
            <p className="text-[10px] text-indigo-600/80 mt-1">
              {metrics.verifiedClaims} of {metrics.totalClaims} claims verified by admin
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80">
            <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Item Return Rate</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{metrics.returnRate}</p>
            <p className="text-[10px] text-emerald-600/80 mt-1">
              {metrics.itemsReturned} items returned to rightful owners
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100/80">
            <p className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">Case Closure Rate</p>
            <p className="text-2xl font-black text-purple-700 mt-1">{metrics.caseClosureRate}</p>
            <p className="text-[10px] text-purple-600/80 mt-1">
              {metrics.closedCases} closed / resolved cases
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/80">
            <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Avg Resolution Speed</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{metrics.avgResolutionTime}</p>
            <p className="text-[10px] text-blue-600/80 mt-1">
              Time from report to successful handover
            </p>
          </div>
        </div>
      </div>

      {/* Trend Data Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Activity Trends Over Time
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Time Window: {timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : timeRange === '90d' ? '90 Days' : 'All Time'}
          </span>
        </div>

        {trendBuckets.length === 0 ? (
          <EmptyState
            title="No trend data available"
            description="Activity logs will plot trend charts once reports or claims are submitted."
            icon={<BarChart3 className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {trendBuckets.map((bucket, idx) => {
                const totalInBucket = bucket.lost + bucket.found + bucket.claims;
                return (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-150 space-y-2">
                    <p className="text-xs font-bold text-slate-800">{bucket.label}</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-amber-50 text-amber-900 border border-amber-150">
                        <span>Lost:</span>
                        <span className="font-bold">{bucket.lost}</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-indigo-50 text-indigo-900 border border-indigo-150">
                        <span>Found:</span>
                        <span className="font-bold">{bucket.found}</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-blue-50 text-blue-900 border border-blue-150">
                        <span>Claims:</span>
                        <span className="font-bold">{bucket.claims}</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-emerald-50 text-emerald-900 border border-emerald-150">
                        <span>Returned:</span>
                        <span className="font-bold">{bucket.returned}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown & Location Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Category Distribution
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">Standard Classifications</span>
          </div>

          {categoryBreakdown.filter((c) => c.count > 0).length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No cataloged item reports for this period.</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown
                .filter((c) => c.count > 0)
                .map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {cat.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-500 font-medium">
                        {cat.count} items ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(cat.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Aggregate Location Insights */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Campus Location Hotspots
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">Privacy Preserved</span>
          </div>

          {locationBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No location details recorded for items yet.</p>
          ) : (
            <div className="space-y-3">
              {locationBreakdown.map((loc) => (
                <div key={loc.location} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                      {loc.location}
                    </span>
                    <span className="text-slate-500 font-medium shrink-0">
                      {loc.count} reports ({loc.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(loc.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Aggregate Privacy Policy:</span> All analytics visualizations presented above calculate high-level campus metrics without exposing private student contact info, telephone numbers, emails, or claim verification documents.
        </div>
      </div>
    </div>
  );
};
