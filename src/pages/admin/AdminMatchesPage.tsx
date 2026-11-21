import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  MapPin,
  Calendar,
  Clock,
  Tag,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  ImageIcon,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ItemMatch } from '../../types';

type MatchFilterTab = 'SUGGESTED' | 'CLAIMED' | 'VERIFIED' | 'DISMISSED' | 'ALL';

export const AdminMatchesPage: React.FC = () => {
  const { session } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [matches, setMatches] = useState<ItemMatch[]>([]);
  const [activeTab, setActiveTab] = useState<MatchFilterTab>('SUGGESTED');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(true);

  const fetchMatches = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/matches?status=ALL', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load potential matches.');
      }
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      if (typeof data.aiReady === 'boolean') {
        setAiReady(data.aiReady);
      }
    } catch (err: any) {
      console.error('[AdminMatchesPage] Fetch error:', err);
      setErrorMessage(err.message || 'Could not retrieve potential matches.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleRunScan = async () => {
    if (!session?.access_token) return;
    setIsScanning(true);
    setErrorMessage(null);
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

      if (data.matchesCreated > 0) {
        showToast({
          type: 'success',
          title: 'Matches Found',
          message: `Evaluated ${data.pairsEvaluated} pair(s) and found ${data.matchesCreated} new potential match${data.matchesCreated === 1 ? '' : 'es'}.`,
        });
      } else {
        showToast({
          type: 'info',
          title: 'Scan Complete',
          message:
            data.pairsEvaluated > 0
              ? `Evaluated ${data.pairsEvaluated} pair(s); no new matches found.`
              : 'All published Lost & Found pairs are already evaluated.',
        });
      }

      await fetchMatches();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Scan Failed',
        message: err.message || 'Could not complete match scan.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdateStatus = async (matchId: string, status: 'VERIFIED' | 'DISMISSED') => {
    if (!session?.access_token) return;
    setUpdatingId(matchId);
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
            ? 'Marked as reviewed. Claims still require manual verification.'
            : 'Match dismissed.',
      });

      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status } : m))
      );
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update match record.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const countByTab = (tab: MatchFilterTab) => {
    if (tab === 'ALL') return matches.length;
    if (tab === 'DISMISSED') {
      return matches.filter((m) => m.status === 'DISMISSED' || m.status === 'NOT_A_MATCH').length;
    }
    return matches.filter((m) => m.status === tab).length;
  };

  const filteredMatches = matches.filter((m) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'DISMISSED') {
      return m.status === 'DISMISSED' || m.status === 'NOT_A_MATCH';
    }
    return m.status === activeTab;
  });

  const tabs: Array<{ key: MatchFilterTab; label: string }> = [
    { key: 'SUGGESTED', label: 'Pending' },
    { key: 'CLAIMED', label: 'Claimed' },
    { key: 'VERIFIED', label: 'Reviewed' },
    { key: 'DISMISSED', label: 'Dismissed' },
    { key: 'ALL', label: 'All' },
  ];

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Potential Matches</h1>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/claims')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Claims
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleRunScan}
            isLoading={isScanning}
            disabled={!aiReady}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Scan Items
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-slate-100/70 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors tabular-nums ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label} ({countByTab(tab.key)})
          </button>
        ))}
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchMatches}>
            Retry
          </Button>
        </div>
      )}

      {/* Matches List */}
      {isLoading ? (
        <LoadingState message="Loading potential matches..." />
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white">
          <EmptyState
            title="No potential matches"
            description={activeTab === 'SUGGESTED' ? 'Run a scan to compare published Lost and Found items.' : undefined}
            icon={<Sparkles className="w-6 h-6" />}
            actionLabel={activeTab === 'SUGGESTED' ? 'Scan Items' : 'View All'}
            onAction={activeTab === 'SUGGESTED' ? handleRunScan : () => setActiveTab('ALL')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => {
            const lost = match.lost_item;
            const found = match.found_item;
            if (!lost || !found) return null;
            const score = match.similarity_score ?? match.match_score;

            return (
              <div
                key={match.id}
                className="rounded-xl border border-slate-200/80 bg-white overflow-hidden"
              >
                {/* Top Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${
                        score >= 80
                          ? 'bg-emerald-50 text-emerald-700'
                          : score >= 65
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {score}% match
                    </span>
                    <StatusBadge status={match.status} size="sm" />
                    {match.existing_claim_id && (
                      <button
                        type="button"
                        onClick={() => navigate('/admin/claims')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          Claim: {(match.existing_claim_status || 'PENDING').replace(/_/g, ' ')}
                        </span>
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {new Date(match.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lost Report */}
                    <div className="rounded-lg border border-slate-200/80 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status="LOST" size="sm" />
                            <StatusBadge status={lost.status} size="sm" />
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {lost.item_name}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-slate-400" />
                            <span>{(lost.category || 'OTHER').replace(/_/g, ' ')}</span>
                          </p>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0">
                          {lost.image_path ? (
                            <img
                              src={lost.image_path}
                              alt={lost.item_name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{lost.location || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{lost.date || '—'}</span>
                        </div>
                        {lost.brand && (
                          <div className="truncate">
                            <span className="text-slate-400">Brand:</span> {lost.brand}
                          </div>
                        )}
                        {lost.color && (
                          <div className="truncate">
                            <span className="text-slate-400">Color:</span> {lost.color}
                          </div>
                        )}
                        {lost.approximate_time && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{lost.approximate_time}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {lost.description || 'No description.'}
                      </p>

                      {lost.unique_marks && (
                        <div className="p-2.5 rounded-md bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950">
                          <span className="font-medium inline-flex items-center gap-1 text-amber-800 mr-1.5">
                            <Lock className="w-3 h-3" /> Private marks:
                          </span>
                          <span className="font-mono text-[11px]">{lost.unique_marks}</span>
                        </div>
                      )}
                    </div>

                    {/* Found Report */}
                    <div className="rounded-lg border border-slate-200/80 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status="FOUND" size="sm" />
                            <StatusBadge status={found.status} size="sm" />
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {found.item_name}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-slate-400" />
                            <span>{(found.category || 'OTHER').replace(/_/g, ' ')}</span>
                          </p>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0">
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
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{found.location || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{found.date || '—'}</span>
                        </div>
                        {found.brand && (
                          <div className="truncate">
                            <span className="text-slate-400">Brand:</span> {found.brand}
                          </div>
                        )}
                        {found.color && (
                          <div className="truncate">
                            <span className="text-slate-400">Color:</span> {found.color}
                          </div>
                        )}
                        {found.approximate_time && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{found.approximate_time}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {found.description || 'No description.'}
                      </p>

                      {found.unique_marks && (
                        <div className="p-2.5 rounded-md bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-950">
                          <span className="font-medium inline-flex items-center gap-1 text-emerald-800 mr-1.5">
                            <Lock className="w-3 h-3" /> Private marks:
                          </span>
                          <span className="font-mono text-[11px]">{found.unique_marks}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Match Reasons */}
                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 p-3.5 space-y-2 text-xs">
                    <p className="text-slate-700 leading-relaxed">{match.ai_summary}</p>
                    {match.match_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {match.match_reasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-white border border-slate-200/80 text-slate-600 text-[11px]"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      Admin verification required before handover.
                    </span>
                    <div className="flex items-center gap-2">
                      {match.existing_claim_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/admin/claims')}
                          leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />}
                        >
                          Review Claim
                        </Button>
                      )}
                      {match.status !== 'DISMISSED' && match.status !== 'NOT_A_MATCH' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updatingId !== null}
                          isLoading={updatingId === match.id}
                          leftIcon={<X className="w-3.5 h-3.5" />}
                          onClick={() => handleUpdateStatus(match.id, 'DISMISSED')}
                        >
                          Dismiss
                        </Button>
                      )}
                      {match.status === 'SUGGESTED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={updatingId !== null}
                          isLoading={updatingId === match.id}
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => handleUpdateStatus(match.id, 'VERIFIED')}
                        >
                          Mark Reviewed
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
