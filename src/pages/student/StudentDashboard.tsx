import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ItemMatch } from '../../types';
import { 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  Package, 
  FileText, 
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Inbox,
  ThumbsDown,
  ExternalLink,
  Info,
  HelpCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { EmptyState } from '../../components/ui/EmptyState';

export const StudentDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [lostCount, setLostCount] = useState(0);
  const [foundCount, setFoundCount] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  const [matches, setMatches] = useState<ItemMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const fetchData = async () => {
    if (!isSupabaseConfigured() || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch lost reports count
      const { count: lost } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'lost');
      setLostCount(lost || 0);

      // 2. Fetch found reports count
      const { count: found } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'found');
      setFoundCount(found || 0);

      // 3. Fetch active claims count
      const { count: claims } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('claimant_id', user.id);
      setClaimCount(claims || 0);

      // 4. Fetch AI match suggestions
      const { data: matchesData, error: matchesErr } = await supabase
        .from('item_matches')
        .select(`
          *,
          lost_item:items!lost_item_id(*),
          found_item:items!found_item_id(*)
        `)
        .eq('status', 'SUGGESTED');

      if (matchesErr) {
        console.error('[Matches Query Error]', matchesErr);
      } else if (matchesData) {
        setMatches(matchesData as ItemMatch[]);
      }

      // 5. Fetch recent activity logs for this college
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('college_id', profile?.college_id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (logs) {
        setRecentActivities(logs);
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, profile?.college_id]);

  const handleDismissMatch = async (matchId: string) => {
    try {
      const { error } = await supabase
        .from('item_matches')
        .update({ status: 'DISMISSED' })
        .eq('id', matchId);

      if (error) {
        showToast({
          type: 'error',
          title: 'Dismissal Failed',
          message: error.message
        });
      } else {
        showToast({
          type: 'success',
          title: 'Suggestion Dismissed',
          message: 'The AI match suggestion has been removed from your list.'
        });
        setMatches(prev => prev.filter(m => m.id !== matchId));
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'An unexpected error occurred.'
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Welcome back</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {profile?.full_name ? `${profile.full_name} • ` : ''}University Student Portal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/help')}
            leftIcon={<HelpCircle className="w-4 h-4 text-indigo-600" />}
          >
            Help Guide
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/student/browse')}
            leftIcon={<Search className="w-4 h-4" />}
          >
            Browse Items
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/student/report-lost')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Report Lost
          </Button>
        </div>
      </div>

      {/* Metrics Row: [Lost Reports] [Found Reports] [Active Claims] */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardCard
          title="Lost Reports"
          value={lostCount.toString()}
          subtitle="Items you are looking for"
          icon={<FileText className="w-5 h-5 text-amber-600" />}
          badge="Live count"
          onClick={() => navigate('/student/activity')}
        />

        <DashboardCard
          title="Found Reports"
          value={foundCount.toString()}
          subtitle="Items you found & logged"
          icon={<Package className="w-5 h-5 text-emerald-600" />}
          badge="Live count"
          onClick={() => navigate('/student/activity')}
        />

        <DashboardCard
          title="Active Claims"
          value={claimCount.toString()}
          subtitle="Claims in verification or handover"
          icon={<ShieldCheck className="w-5 h-5 text-indigo-600" />}
          badge="Live count"
          onClick={() => navigate('/student/activity')}
        />
      </div>

      {/* Possible Match Suggestions Section */}
      {matches.length > 0 && (
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/20 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                AI-Assisted Match Suggestions
              </h2>
              <p className="text-xs text-slate-500">
                Google Gemini analyzed your listings and identified potential matches in the database.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {matches.map((match) => {
              const isLostOurs = match.lost_item?.user_id === user?.id;
              const ours = isLostOurs ? match.lost_item : match.found_item;
              const theirs = isLostOurs ? match.found_item : match.lost_item;

              if (!ours || !theirs) return null;

              return (
                <div key={match.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start justify-between">
                  <div className="space-y-3 flex-1">
                    {/* Badge & Info Header */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                        {match.match_score}% AI Confidence
                      </span>
                      <span className="text-xs text-slate-400">
                        Comparing your <strong>{ours.item_name}</strong> to found list
                      </span>
                    </div>

                    {/* Comparison Details */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        Potential Match: {theirs.item_name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Category: <strong className="text-slate-700">{theirs.category}</strong> • Found at <strong className="text-slate-700">{theirs.location}</strong> on <strong className="text-slate-700">{theirs.date}</strong>
                      </p>
                    </div>

                    {/* Summary & Reasons */}
                    <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-2 border border-slate-100">
                      <p className="font-medium text-slate-700">{match.ai_summary}</p>
                      {match.match_reasons.length > 0 && (
                        <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-500">
                          {match.match_reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Right Side Image & Actions */}
                  <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto items-center md:items-end justify-between md:justify-start border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                    {theirs.image_path ? (
                      <img 
                        src={theirs.image_path} 
                        alt={theirs.item_name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<ThumbsDown className="w-3.5 h-3.5" />}
                        onClick={() => handleDismissMatch(match.id)}
                      >
                        Not a Match
                      </Button>
                      
                      {isLostOurs ? (
                        <Button
                          size="sm"
                          variant="primary"
                          rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/student/item/${theirs.id}`)}
                        >
                          View & Claim
                        </Button>
                      ) : (
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-slate-400" />
                          <span>Owner notified</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/student/report-lost')}
            className="p-5 rounded-2xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50/80 text-left transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-amber-800 transition">
              Report Lost Item
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Lost keys, electronics, or cards? Post details to match incoming finds.
            </p>
          </button>

          <button
            onClick={() => navigate('/student/report-found')}
            className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/80 text-left transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-800 transition">
              Report Found Item
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Found unattended items on campus? Help them safely reach their owner.
            </p>
          </button>

          <button
            onClick={() => navigate('/student/browse')}
            className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/80 text-left transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-800 transition">
              Browse College Items
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Search all published campus items by category, location, and date.
            </p>
          </button>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Campus Activity Log
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/student/activity')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            View My Activity
          </Button>
        </div>

        {recentActivities.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentActivities.map((log) => (
              <div key={log.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-700 font-semibold">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500">
                    {log.metadata?.item_name ? `Item: "${log.metadata.item_name}" • ` : ''}
                    {new Date(log.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No activity yet"
            description="When you report lost belongings, log found property, or submit verification claims, your real-time status will appear here."
            icon={<Inbox className="w-7 h-7 text-slate-400" />}
            actionLabel="Report an Item"
            onAction={() => navigate('/student/report-lost')}
          />
        )}
      </div>
    </div>
  );
};
