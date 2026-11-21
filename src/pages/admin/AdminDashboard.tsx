import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ItemMatch, Item } from '../../types';
import {
  FileText,
  CheckSquare,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Inbox,
  Sparkles,
  Check,
  X,
  MapPin,
  Calendar,
  Search,
  Users,
  Clock,
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const AdminDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { profile, session, configuredCollege } = useAuth();
  const { showToast } = useToast();

  const [collegeName, setCollegeName] = useState<string>(configuredCollege?.name || '');
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [pendingLostCount, setPendingLostCount] = useState<number>(0);
  const [pendingFoundCount, setPendingFoundCount] = useState<number>(0);
  const [activeClaimsCount, setActiveClaimsCount] = useState<number>(0);
  const [returnedCount, setReturnedCount] = useState<number>(0);

  const [recentReports, setRecentReports] = useState<Item[]>([]);
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [matches, setMatches] = useState<ItemMatch[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingMatch, setIsUpdatingMatch] = useState<string | null>(null);
  const [isScanningMatches, setIsScanningMatches] = useState(false);

  const targetCollegeId = profile?.college_id || configuredCollege?.id;

  useEffect(() => {
    if (configuredCollege?.name) {
      setCollegeName(configuredCollege.name);
    }
  }, [configuredCollege?.name]);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      if (!isSupabaseConfigured() || !targetCollegeId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (!configuredCollege?.name) {
          const { data: colData } = await supabase
            .from('colleges')
            .select('name')
            .eq('id', targetCollegeId)
            .maybeSingle();
          if (isMounted && colData?.name) {
            setCollegeName(colData.name);
          }
        }

        const { count: studentCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', targetCollegeId)
          .in('role', ['student', 'STUDENT']);
        if (isMounted) setTotalStudentsCount(studentCount || 0);

        const { count: pendingLost } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', targetCollegeId)
          .in('type', ['lost', 'LOST'])
          .in('status', ['pending', 'PENDING']);
        if (isMounted) setPendingLostCount(pendingLost || 0);

        const { count: pendingFound } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', targetCollegeId)
          .in('type', ['found', 'FOUND'])
          .in('status', ['pending', 'PENDING']);
        if (isMounted) setPendingFoundCount(pendingFound || 0);

        const { data: repData } = await supabase
          .from('items')
          .select('*')
          .eq('college_id', targetCollegeId)
          .in('status', ['pending', 'PENDING'])
          .order('created_at', { ascending: false })
          .limit(5);
        if (isMounted && repData) {
          setRecentReports(
            repData.map((r: any) => ({
              ...r,
              type: (r.type || 'LOST').toUpperCase(),
              status: (r.status || 'PENDING').toUpperCase(),
            })) as Item[]
          );
        }

        const { count: activeClaims, data: claData } = await supabase
          .from('claims')
          .select('*, items(item_name, type, location, date)', { count: 'exact' })
          .eq('college_id', targetCollegeId)
          .in('status', [
            'pending',
            'under_review',
            'approved',
            'handover',
            'PENDING',
            'UNDER_REVIEW',
            'APPROVED',
            'HANDOVER',
          ])
          .order('created_at', { ascending: false })
          .limit(5);
        if (isMounted) {
          setActiveClaimsCount(activeClaims || 0);
          if (claData) {
            setRecentClaims(claData);
          }
        }

        const { count: returnedItems } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', targetCollegeId)
          .in('status', ['returned', 'RETURNED']);
        if (isMounted) setReturnedCount(returnedItems || 0);

        const { data: activityData, error: activityErr } = await supabase
          .from('activity_logs')
          .select('*, profiles:actor_id(full_name, email)')
          .eq('college_id', targetCollegeId)
          .order('created_at', { ascending: false })
          .limit(6);
        if (!activityErr && activityData) {
          if (isMounted) setRecentActivity(activityData);
        } else {
          const { data: fallbackActivity } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('college_id', targetCollegeId)
            .order('created_at', { ascending: false })
            .limit(6);
          if (isMounted && fallbackActivity) {
            setRecentActivity(fallbackActivity);
          }
        }

        if (session?.access_token) {
          const matchRes = await fetch('/api/admin/matches?status=SUGGESTED', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (matchRes.ok) {
            const matchJson = await matchRes.json();
            if (isMounted && Array.isArray(matchJson.matches)) {
              setMatches(matchJson.matches as ItemMatch[]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching admin statistics:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      isMounted = false;
    };
  }, [targetCollegeId, configuredCollege?.name, session?.access_token]);

  const handleScanMatches = async () => {
    if (!session?.access_token) return;
    setIsScanningMatches(true);
    try {
      const res = await fetch('/api/match/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan published reports.');
      }

      const refreshRes = await fetch('/api/admin/matches?status=SUGGESTED', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setMatches(Array.isArray(refreshJson.matches) ? refreshJson.matches : []);
      }

      showToast({
        type: data.matchesCreated > 0 ? 'success' : 'info',
        title: data.matchesCreated > 0 ? 'Matches Found' : 'Scan Complete',
        message:
          data.matchesCreated > 0
            ? `Found ${data.matchesCreated} new potential match${data.matchesCreated === 1 ? '' : 'es'}.`
            : 'All published Lost & Found pairs are up to date.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Scan Failed',
        message: err.message || 'Could not complete match scan.',
      });
    } finally {
      setIsScanningMatches(false);
    }
  };

  const handleUpdateMatchStatus = async (matchId: string, status: 'VERIFIED' | 'DISMISSED') => {
    if (!session?.access_token) return;
    setIsUpdatingMatch(matchId);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update match status.');
      }

      showToast({
        type: 'success',
        title: status === 'VERIFIED' ? 'Match Reviewed' : 'Match Dismissed',
        message:
          status === 'VERIFIED'
            ? 'Marked as reviewed. Ownership verification remains manual.'
            : 'Suggestion dismissed.',
      });
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdatingMatch(null);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  const totalPendingReports = pendingLostCount + pendingFoundCount;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          {collegeName && (
            <span className="text-xs text-slate-400 font-medium truncate">{collegeName}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/admin/students')}
            leftIcon={<Users className="w-3.5 h-3.5 text-slate-500" />}
            title="View campus student directory"
          >
            <span className="tabular-nums">{totalStudentsCount}</span> Students
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/export')}
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
          >
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/analytics')}
            leftIcon={<BarChart3 className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/admin/claims')}
            leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
          >
            Claims
          </Button>
        </div>
      </div>

      {/* Quick Search */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search items, claims, or students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                navigate(`/admin/items?search=${encodeURIComponent(searchQuery)}`);
              }
            }}
          />
        </div>
        {searchQuery.trim() && (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/admin/items?search=${encodeURIComponent(searchQuery)}`)}
              leftIcon={<FileText className="w-3.5 h-3.5" />}
            >
              Items
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate(`/admin/claims?search=${encodeURIComponent(searchQuery)}`)}
              leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
            >
              Claims
            </Button>
          </div>
        )}
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <DashboardCard
          title="Pending Reports"
          value={totalPendingReports}
          subtitle={`${pendingLostCount} lost · ${pendingFoundCount} found`}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          onClick={() => navigate('/admin/items')}
        />
        <DashboardCard
          title="Active Claims"
          value={activeClaimsCount}
          subtitle="Awaiting verification"
          icon={<CheckSquare className="w-4 h-4 text-indigo-600" />}
          onClick={() => navigate('/admin/verification')}
        />
        <DashboardCard
          title="Potential Matches"
          value={matches.length}
          subtitle="Pending review"
          icon={<Sparkles className="w-4 h-4 text-indigo-600" />}
          onClick={() => navigate('/admin/matches')}
        />
        <DashboardCard
          title="Returned"
          value={returnedCount}
          subtitle="Completed handovers"
          icon={<RotateCcw className="w-4 h-4 text-emerald-600" />}
          onClick={() => navigate('/admin/handover')}
        />
      </div>

      {/* Pending Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Pending Reports</h2>
              {totalPendingReports > 0 && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded tabular-nums">
                  {totalPendingReports}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/items')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              All items
            </Button>
          </div>

          {recentReports.length === 0 ? (
            <EmptyState
              className="border-0 rounded-none py-8"
              title="No pending reports"
              icon={<Inbox className="w-5 h-5 text-slate-400" />}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentReports.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    navigate(item.type === 'LOST' ? '/admin/lost-reports' : '/admin/found-reports')
                  }
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.item_name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5 tabular-nums">
                      {item.location} · {item.date}
                    </p>
                  </div>
                  <StatusBadge status={item.type} size="sm" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Active Claims</h2>
              {activeClaimsCount > 0 && (
                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded tabular-nums">
                  {activeClaimsCount}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/claims')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              All claims
            </Button>
          </div>

          {recentClaims.length === 0 ? (
            <EmptyState
              className="border-0 rounded-none py-8"
              title="No active claims"
              icon={<ShieldCheck className="w-5 h-5 text-slate-400" />}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentClaims.map((claim) => (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => navigate('/admin/claims')}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {claim.items?.item_name || 'Item Claim'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={(claim.status || 'PENDING').toUpperCase()} size="sm" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Potential Matches Queue */}
      <section className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Potential Matches</h2>
            <span className="text-xs font-medium text-slate-500 tabular-nums">({matches.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleScanMatches}
              isLoading={isScanningMatches}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Scan published Lost & Found reports for potential matches"
            >
              Scan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate('/admin/matches')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View all
            </Button>
          </div>
        </div>

        {matches.length === 0 ? (
          <EmptyState
            className="border-0 rounded-none py-8"
            title="No pending match suggestions"
            icon={<Sparkles className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {matches.slice(0, 3).map((match) => {
              const lost = match.lost_item;
              const found = match.found_item;
              if (!lost || !found) return null;
              const score = match.similarity_score ?? match.match_score;

              return (
                <div key={match.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 tabular-nums">
                        {score}% match
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {new Date(match.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<X className="w-3.5 h-3.5" />}
                        disabled={isUpdatingMatch !== null}
                        onClick={() => handleUpdateMatchStatus(match.id, 'DISMISSED')}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        disabled={isUpdatingMatch !== null}
                        onClick={() => handleUpdateMatchStatus(match.id, 'VERIFIED')}
                      >
                        Review
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/40 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <StatusBadge status="LOST" size="sm" />
                        <p className="text-sm font-semibold text-slate-900 truncate">{lost.item_name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {lost.location}
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            {lost.date}
                          </span>
                        </div>
                      </div>
                      {lost.image_path && (
                        <img
                          src={lost.image_path}
                          alt={lost.item_name}
                          className="w-11 h-11 rounded-lg object-cover shrink-0 border border-slate-200/70"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/40 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <StatusBadge status="FOUND" size="sm" />
                        <p className="text-sm font-semibold text-slate-900 truncate">{found.item_name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {found.location}
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            {found.date}
                          </span>
                        </div>
                      </div>
                      {found.image_path && (
                        <img
                          src={found.image_path}
                          alt={found.item_name}
                          className="w-11 h-11 rounded-lg object-cover shrink-0 border border-slate-200/70"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  </div>

                  {match.ai_summary && (
                    <p className="text-xs text-slate-600 leading-relaxed">{match.ai_summary}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Compact Recent Activity */}
      <section className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/activity-logs')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Audit log
          </Button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">No recent activity.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((log) => {
              const actionLabel = (log.action || 'EVENT')
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/\b\w/g, (c: string) => c.toUpperCase());
              const actorObj = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
              const actorName = actorObj?.full_name || 'System';
              const subject =
                log.metadata?.item_name || log.metadata?.target_name || log.entity_type || '';

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-medium text-slate-900 shrink-0">{actionLabel}</span>
                    {subject && (
                      <span className="text-slate-500 truncate">{subject}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-slate-400">
                    <span className="hidden sm:inline">{actorName}</span>
                    <span className="tabular-nums">
                      {new Date(log.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
