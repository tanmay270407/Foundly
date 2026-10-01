import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ItemMatch } from '../../types';
import { 
  Building2, 
  FileText, 
  CheckSquare, 
  RotateCcw, 
  ArrowRight,
  ShieldCheck,
  PackageOpen,
  Inbox,
  Loader2,
  Sparkles,
  Check,
  X,
  MapPin,
  Calendar,
  AlertCircle,
  Search,
  Activity,
  Handshake,
  Clock,
  BarChart3,
  BookOpen
} from 'lucide-react';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Item } from '../../types';

export const AdminDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [collegeName, setCollegeName] = useState<string>('');
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);
  const [publishedReportsCount, setPublishedReportsCount] = useState<number>(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState<number>(0);
  const [activeHandoversCount, setActiveHandoversCount] = useState<number>(0);
  const [returnedCount, setReturnedCount] = useState<number>(0);

  const [recentReports, setRecentReports] = useState<Item[]>([]);
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [matches, setMatches] = useState<ItemMatch[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingMatch, setIsUpdatingMatch] = useState<string | null>(null);
  const [isCollegeDeactivated, setIsCollegeDeactivated] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      if (!isSupabaseConfigured() || !profile?.college_id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch College Name and check activation status
        const { data: colData } = await supabase
          .from('colleges')
          .select('*')
          .eq('id', profile.college_id)
          .single();
        if (isMounted && colData) {
          setCollegeName(colData.name);
          if (colData.domain?.startsWith('[DEACTIVATED]')) {
            setIsCollegeDeactivated(true);
          }
        }

        // 2. Fetch Pending Reports Count
        const { count: pendingReports, data: repData } = await supabase
          .from('items')
          .select('*', { count: 'exact' })
          .eq('college_id', profile.college_id)
          .eq('status', 'pending');

        if (isMounted) {
          setPendingReportsCount(pendingReports || 0);
          if (repData) {
            setRecentReports(repData.slice(0, 5) as Item[]);
          }
        }

        // 3. Fetch Published Reports Count
        const { count: publishedReports } = await supabase
          .from('items')
          .select('*', { count: 'exact' })
          .eq('college_id', profile.college_id)
          .eq('status', 'published');
        if (isMounted) {
          setPublishedReportsCount(publishedReports || 0);
        }

        // 4. Fetch Pending Claims Count
        const { count: pendingClaims, data: claData } = await supabase
          .from('claims')
          .select('*, items(item_name, type, location, date)', { count: 'exact' })
          .eq('college_id', profile.college_id)
          .eq('status', 'pending');
        if (isMounted) {
          setPendingClaimsCount(pendingClaims || 0);
          if (claData) {
            setRecentClaims(claData.slice(0, 5));
          }
        }

        // 5. Fetch Active Handovers Count
        const { count: handoversCount } = await supabase
          .from('claims')
          .select('*', { count: 'exact' })
          .eq('college_id', profile.college_id)
          .in('status', ['handover', 'approved']);
        if (isMounted) {
          setActiveHandoversCount(handoversCount || 0);
        }

        // 6. Fetch Recently Returned / Closed Count
        const { count: returnedItems } = await supabase
          .from('items')
          .select('*', { count: 'exact' })
          .eq('college_id', profile.college_id)
          .eq('status', 'returned');
        if (isMounted) {
          setReturnedCount(returnedItems || 0);
        }

        // 7. Fetch Recent Activity Logs for this college
        const { data: activityData } = await supabase
          .from('activity_logs')
          .select('*, profiles:actor_id(full_name, email)')
          .eq('college_id', profile.college_id)
          .order('created_at', { ascending: false })
          .limit(6);
        if (isMounted && activityData) {
          setRecentActivity(activityData);
        }

        // 8. Fetch pending AI Match Suggestions for this college
        const { data: matchesData } = await supabase
          .from('item_matches')
          .select(`
            *,
            lost_item:items!lost_item_id(*),
            found_item:items!found_item_id(*)
          `)
          .eq('college_id', profile.college_id)
          .eq('status', 'SUGGESTED')
          .order('match_score', { ascending: false });
        if (isMounted && matchesData) {
          setMatches(matchesData as ItemMatch[]);
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
  }, [profile?.college_id]);

  const handleUpdateMatchStatus = async (matchId: string, status: 'VERIFIED' | 'NOT_A_MATCH') => {
    setIsUpdatingMatch(matchId);
    try {
      const { error } = await supabase
        .from('item_matches')
        .update({ status })
        .eq('id', matchId);

      if (error) {
        showToast({
          type: 'error',
          title: 'Operation Failed',
          message: error.message
        });
      } else {
        showToast({
          type: 'success',
          title: status === 'VERIFIED' ? 'Match Kept & Verified' : 'Match Dismissed',
          message: status === 'VERIFIED' 
            ? 'The suggestion has been successfully marked as a verified match.' 
            : 'The suggestion has been rejected.'
        });
        setMatches(prev => prev.filter(m => m.id !== matchId));
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'An unexpected error occurred.'
      });
    } finally {
      setIsUpdatingMatch(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-3 text-slate-500 animate-fade-in">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs font-medium">Loading Operations Panel...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
      {isCollegeDeactivated && (
        <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3 shadow-xs" id="admin-deactivated-banner">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <strong className="font-bold block text-sm text-slate-900 mb-0.5">Campus Partition Deactivated</strong>
            Your college directory is currently deactivated by the platform owner. Under deactivated directories, new lost/found reports, claims, and administrative operations are suspended.
          </div>
        </div>
      )}

      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              College Admin Console
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {collegeName || 'My College'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Campus Lost & Found Operations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Managing reports, verification claims, and handovers for {collegeName || 'your campus'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/guide')}
            leftIcon={<BookOpen className="w-4 h-4 text-indigo-600" />}
          >
            Admin Guide
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/analytics')}
            leftIcon={<BarChart3 className="w-4 h-4 text-purple-600" />}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/reports')}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Reports
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/admin/claims')}
            leftIcon={<CheckSquare className="w-4 h-4" />}
          >
            Claims
          </Button>
        </div>
      </div>

      {/* Quick Admin Search & Navigation Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Input
            placeholder="Search by item name, report ref ID, claim ref ID, or student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        {searchQuery.trim() && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/admin/reports?search=${encodeURIComponent(searchQuery)}`)}
              leftIcon={<FileText className="w-3.5 h-3.5" />}
            >
              Search Reports
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate(`/admin/claims?search=${encodeURIComponent(searchQuery)}`)}
              leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
            >
              Search Claims
            </Button>
          </div>
        )}
      </div>

      {/* Metric Cards: Pending Reports, Published, Claims, Handovers, Returned */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <DashboardCard
          title="Pending Reports"
          value={String(pendingReportsCount)}
          subtitle="Awaiting review"
          icon={<FileText className="w-4 h-4 text-amber-600" />}
          badge="Approval"
          onClick={() => navigate('/admin/reports')}
        />

        <DashboardCard
          title="Published Reports"
          value={String(publishedReportsCount)}
          subtitle="Active directory"
          icon={<PackageOpen className="w-4 h-4 text-indigo-600" />}
          badge="Live"
          onClick={() => navigate('/admin/reports')}
        />

        <DashboardCard
          title="Pending Claims"
          value={String(pendingClaimsCount)}
          subtitle="Awaiting verification"
          icon={<CheckSquare className="w-4 h-4 text-blue-600" />}
          badge="Verify"
          onClick={() => navigate('/admin/claims')}
        />

        <DashboardCard
          title="Active Handovers"
          value={String(activeHandoversCount)}
          subtitle="Handover queue"
          icon={<Handshake className="w-4 h-4 text-purple-600" />}
          badge="Pending Pickup"
          onClick={() => navigate('/admin/claims')}
        />

        <DashboardCard
          title="Returned / Closed"
          value={String(returnedCount)}
          subtitle="Completed cases"
          icon={<RotateCcw className="w-4 h-4 text-emerald-600" />}
          badge="Returned"
          onClick={() => navigate('/admin/claims')}
        />
      </div>

      {/* AI Matches Review Queue */}
      <div className="rounded-3xl border border-indigo-100 bg-indigo-50/15 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              AI-Generated Match Suggestions ({matches.length})
            </h2>
            <p className="text-xs text-slate-500">
              Google Gemini cross-references lost and found reports to find potential matches. Review and verify them below.
            </p>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs">
            No active AI suggestions requiring review. Matches generate automatically as new listings are approved.
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const lost = match.lost_item;
              const found = match.found_item;

              if (!lost || !found) return null;

              return (
                <div key={match.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
                  {/* Confidence Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                      {match.match_score}% Confidence
                    </span>
                    <span className="text-xs text-slate-400">
                      Suggested {new Date(match.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Side-by-Side Match Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lost side */}
                    <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/20 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[10px] font-bold text-amber-800">LOST REPORT</span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{lost.item_name}</h4>
                        </div>
                        {lost.image_path && (
                          <img src={lost.image_path} alt={lost.item_name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        )}
                      </div>
                      <div className="text-xs space-y-1 text-slate-600">
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> <span>{lost.location}</span></div>
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> <span>{lost.date}</span></div>
                        <p className="text-slate-500 leading-normal line-clamp-2 italic">"{lost.description}"</p>
                      </div>
                    </div>

                    {/* Found side */}
                    <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/20 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[10px] font-bold text-emerald-800">FOUND REPORT</span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{found.item_name}</h4>
                        </div>
                        {found.image_path && (
                          <img src={found.image_path} alt={found.item_name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        )}
                      </div>
                      <div className="text-xs space-y-1 text-slate-600">
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> <span>{found.location}</span></div>
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> <span>{found.date}</span></div>
                        <p className="text-slate-500 leading-normal line-clamp-2 italic">"{found.description}"</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Explanation Summary */}
                  <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 border border-slate-100">
                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Gemini Evaluation:</span>
                    </p>
                    <p className="text-slate-600 leading-normal font-medium">{match.ai_summary}</p>
                    {match.match_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {match.match_reasons.map((reason, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white border border-slate-150 rounded-md text-[10px] font-medium text-slate-600">
                            • {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action row */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<X className="w-3.5 h-3.5" />}
                      disabled={isUpdatingMatch !== null}
                      onClick={() => handleUpdateMatchStatus(match.id, 'NOT_A_MATCH')}
                    >
                      Not a Match
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      disabled={isUpdatingMatch !== null}
                      onClick={() => handleUpdateMatchStatus(match.id, 'VERIFIED')}
                    >
                      Verify Match
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Review Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reports Overview */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Reports Review Queue
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/reports')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View all reports
              </Button>
            </div>
            
            {recentReports.length === 0 ? (
              <EmptyState
                title="No pending reports"
                description="All incoming lost and found submissions for your campus have been processed or none have been submitted yet."
                icon={<Inbox className="w-6 h-6 text-slate-400" />}
              />
            ) : (
              <div className="space-y-2.5">
                {recentReports.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{item.item_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.location} • {item.date}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.type === 'FOUND' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Claims Overview */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Claims Verification Queue
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/claims')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View all claims
              </Button>
            </div>

            {recentClaims.length === 0 ? (
              <EmptyState
                title="No pending claims"
                description="There are currently no active ownership claims awaiting admin inspection or handover authorization."
                icon={<ShieldCheck className="w-6 h-6 text-slate-400" />}
              />
            ) : (
              <div className="space-y-2.5">
                {recentClaims.map(claim => (
                  <div key={claim.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">Claim for {claim.items?.item_name || 'Item'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Submitted {new Date(claim.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                      PENDING
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Operational Activity Logs Feed */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Operational Activity Log
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Campus Scoped</span>
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No recent operational logs recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentActivity.map((log) => {
              const actionLabel = log.action.replace(/_/g, ' ');
              const actorName = log.profiles?.full_name || 'System / Admin';
              return (
                <div key={log.id} className="p-3 rounded-2xl bg-slate-50/70 border border-slate-150 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 text-[10px] uppercase px-2 py-0.5 rounded bg-indigo-50 border border-indigo-150">
                      {actionLabel}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-800 font-semibold mt-1">
                    {log.metadata?.item_name || log.metadata?.full_name || log.entity_type}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    By: {actorName}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Data Partition Architecture Reminder */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <Building2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Row-Level Security (RLS) Enforced:</p>
          <p className="text-amber-800 mt-0.5 leading-relaxed">
            As an authorized College Admin, database partition rules guarantee you only receive and moderate reports belonging strictly to <strong>{collegeName || 'your associated campus'}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
