import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Search,
  PlusCircle,
  Package,
  ShieldCheck,
  ArrowRight,
  Inbox,
  Sparkles,
  AlertTriangle,
  MapPin,
  Calendar,
  Eye,
  X,
  Check,
  Loader2,
  ImageIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ItemMatch } from '../../types';

export const StudentDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { user, profile, session, configuredCollege } = useAuth();
  const { showToast } = useToast();

  const [lostCount, setLostCount] = useState(0);
  const [foundCount, setFoundCount] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  const [publishedCampusCount, setPublishedCampusCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const [potentialMatches, setPotentialMatches] = useState<ItemMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [dismissingMatchId, setDismissingMatchId] = useState<string | null>(null);

  const [confirmMatch, setConfirmMatch] = useState<ItemMatch | null>(null);
  const [additionalNote, setAdditionalNote] = useState('');
  const [isSubmittingLinkedClaim, setIsSubmittingLinkedClaim] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return;

    try {
      const [{ count: lost }, { count: found }, { count: claims }] = await Promise.all([
        supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('type', ['lost', 'LOST']),
        supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('type', ['found', 'FOUND']),
        supabase
          .from('claims')
          .select('*', { count: 'exact', head: true })
          .eq('claimant_id', user.id),
      ]);

      setLostCount(lost || 0);
      setFoundCount(found || 0);
      setClaimCount(claims || 0);

      const targetCollegeId = profile?.college_id || configuredCollege?.id;
      if (targetCollegeId) {
        const [{ count: published }, { data: logs }] = await Promise.all([
          supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('college_id', targetCollegeId)
            .in('type', ['found', 'FOUND'])
            .in('status', ['published', 'approved', 'PUBLISHED', 'APPROVED']),
          supabase
            .from('activity_logs')
            .select('*')
            .eq('college_id', targetCollegeId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        setPublishedCampusCount(published || 0);
        if (logs) {
          setRecentActivities(logs);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, [user, profile?.college_id, configuredCollege?.id]);

  const fetchMatches = useCallback(async () => {
    if (!session?.access_token || !user) return;

    setIsLoadingMatches(true);
    setMatchesError(null);
    try {
      const res = await fetch('/api/student/matches', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load matches.');
      }
      setPotentialMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (err: any) {
      console.error('Error fetching student matches:', err);
      setMatchesError(err.message || 'Could not load matches.');
    } finally {
      setIsLoadingMatches(false);
    }
  }, [session?.access_token, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleDismissMatch = async (matchId: string) => {
    if (!session?.access_token) return;
    setDismissingMatchId(matchId);
    try {
      const res = await fetch(`/api/student/matches/${matchId}/dismiss`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dismiss match.');
      }
      setPotentialMatches((prev) => prev.filter((m) => m.id !== matchId));
      showToast({
        type: 'info',
        title: 'Dismissed',
        message: 'Match suggestion removed.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Dismiss failed',
        message: err.message || 'Could not dismiss match.',
      });
    } finally {
      setDismissingMatchId(null);
    }
  };

  const handleConfirmLinkedClaim = async () => {
    if (!confirmMatch || !session?.access_token) return;

    setIsSubmittingLinkedClaim(true);
    try {
      const res = await fetch('/api/student/claims/from-lost-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          foundItemId: confirmMatch.found_item_id,
          lostItemId: confirmMatch.lost_item_id,
          matchId: confirmMatch.id,
          additionalNote: additionalNote.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit claim.');
      }

      showToast({
        type: 'success',
        title: 'Claim submitted',
        message: 'Sent to College Admin for verification.',
      });

      setConfirmMatch(null);
      setAdditionalNote('');
      await Promise.all([fetchData(), fetchMatches()]);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission failed',
        message: err.message || 'Please try again.',
      });
    } finally {
      setIsSubmittingLinkedClaim(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Home</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/student/report-lost')}
            leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          >
            Report Lost
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/student/report-found')}
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            Report Found
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <DashboardCard
          title="Lost Reports"
          value={lostCount}
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          onClick={() => navigate('/student/reports')}
        />
        <DashboardCard
          title="Found Reports"
          value={foundCount}
          icon={<Package className="w-4 h-4 text-emerald-600" />}
          onClick={() => navigate('/student/reports')}
        />
        <DashboardCard
          title="My Claims"
          value={claimCount}
          icon={<ShieldCheck className="w-4 h-4 text-indigo-600" />}
          onClick={() => navigate('/student/claims')}
        />
        <DashboardCard
          title="Found Catalog"
          value={publishedCampusCount}
          icon={<Search className="w-4 h-4 text-slate-500" />}
          onClick={() => navigate('/student/browse')}
        />
      </div>

      {/* Potential Matches */}
      {(isLoadingMatches || matchesError || potentialMatches.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Potential Matches</span>
              {potentialMatches.length > 0 && (
                <span className="text-xs font-mono text-indigo-600 tabular-nums">
                  {potentialMatches.length}
                </span>
              )}
            </h2>
          </div>

          {isLoadingMatches ? (
            <div className="rounded-xl border border-slate-200/80 bg-white py-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Checking matches...</span>
            </div>
          ) : matchesError ? (
            <div className="p-4 rounded-xl bg-white border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-3">
              <span>{matchesError}</span>
              <Button size="sm" variant="outline" onClick={fetchMatches}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {potentialMatches.map((match) => {
                const lost = match.lost_item;
                const found = match.found_item;
                if (!lost || !found) return null;

                const score = match.similarity_score ?? match.match_score;
                const isLostOwner = match.user_role_in_match === 'LOST_OWNER';
                const hasClaim = Boolean(match.existing_claim_id);

                return (
                  <div
                    key={match.id}
                    className="rounded-xl border border-indigo-200/80 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200/70 overflow-hidden flex items-center justify-center shrink-0">
                        {found.image_path ? (
                          <img
                            src={found.image_path}
                            alt={found.item_name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {found.item_name}
                          </h3>
                          <span className="text-xs font-mono font-semibold text-indigo-600 tabular-nums">
                            {score}% match
                          </span>
                          {hasClaim && (
                            <StatusBadge
                              status={match.existing_claim_status || 'PENDING'}
                              size="sm"
                            />
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {found.location || 'Campus'}
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {found.date}
                          </span>
                          <span className="text-slate-400">
                            {isLostOwner ? `For "${lost.item_name}"` : 'Matched a Lost Report'}
                          </span>
                        </div>

                        {match.match_reasons.length > 0 && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {match.match_reasons.slice(0, 3).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={dismissingMatchId !== null}
                        isLoading={dismissingMatchId === match.id}
                        onClick={() => handleDismissMatch(match.id)}
                        title="Dismiss match"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => navigate(`/student/item/${found.id}`)}
                      >
                        View
                      </Button>

                      {isLostOwner && hasClaim && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => navigate('/student/claims')}
                        >
                          Track Claim
                        </Button>
                      )}

                      {match.can_claim_from_lost_report && (
                        <Button
                          size="sm"
                          variant="primary"
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setConfirmMatch(match);
                            setAdditionalNote('');
                          }}
                        >
                          This Is My Item
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Recent Activity */}
      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <button
            type="button"
            onClick={() => navigate('/student/reports')}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            <span>My Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          {recentActivities.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((log) => (
                <div
                  key={log.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 capitalize">
                      {String(log.action || '').toLowerCase().replace(/_/g, ' ')}
                    </span>
                    {log.metadata?.item_name && (
                      <span className="text-slate-500"> · {log.metadata.item_name}</span>
                    )}
                  </div>
                  <span className="text-slate-400 tabular-nums shrink-0">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No activity yet"
              icon={<Inbox className="w-5 h-5 text-slate-400" />}
              actionLabel="Browse Items"
              onAction={() => navigate('/student/browse')}
            />
          )}
        </div>
      </section>

      {/* One-Click Linked Claim Confirmation Modal */}
      {confirmMatch && confirmMatch.lost_item && confirmMatch.found_item && (
        <Modal
          isOpen={Boolean(confirmMatch)}
          onClose={() => {
            if (!isSubmittingLinkedClaim) {
              setConfirmMatch(null);
              setAdditionalNote('');
            }
          }}
          title="Confirm: This Is My Item"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-amber-700">Your Lost Report</span>
                <p className="font-semibold text-slate-900 text-sm">
                  {confirmMatch.lost_item.item_name}
                </p>
                <p className="text-slate-500">
                  {confirmMatch.lost_item.location} · {confirmMatch.lost_item.date}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-emerald-700">Found Item</span>
                <p className="font-semibold text-slate-900 text-sm">
                  {confirmMatch.found_item.item_name}
                </p>
                <p className="text-slate-500">
                  {confirmMatch.found_item.location} · {confirmMatch.found_item.date}
                </p>
              </div>
            </div>

            <Textarea
              label="Note for Admin (optional)"
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder="Any extra identifying detail..."
              rows={2}
            />

            <p className="text-xs text-slate-500">
              Your Lost Report details will be linked automatically. College Admin verification is required before handover.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmittingLinkedClaim}
                onClick={() => {
                  setConfirmMatch(null);
                  setAdditionalNote('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmittingLinkedClaim}
                leftIcon={<Check className="w-3.5 h-3.5" />}
                onClick={handleConfirmLinkedClaim}
              >
                Submit Claim
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
