import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';

interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  actor?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

const ACTION_BADGE_COLORS: Record<string, string> = {
  ITEM_APPROVED: 'bg-emerald-50 text-emerald-700',
  REPORT_APPROVED: 'bg-emerald-50 text-emerald-700',
  ITEM_REJECTED: 'bg-rose-50 text-rose-700',
  REPORT_REJECTED: 'bg-rose-50 text-rose-700',
  CLAIM_APPROVED: 'bg-emerald-50 text-emerald-700',
  CLAIM_REJECTED: 'bg-rose-50 text-rose-700',
  HANDOVER_SCHEDULED: 'bg-indigo-50 text-indigo-700',
  RETURN_CONFIRMED: 'bg-emerald-50 text-emerald-700',
  ADMIN_ROLE_ASSIGNED: 'bg-amber-50 text-amber-800',
  ADMIN_ROLE_REVOKED: 'bg-rose-50 text-rose-700',
  REPORTS_EXPORTED: 'bg-sky-50 text-sky-700',
  OFFICE_SETTINGS_UPDATED: 'bg-indigo-50 text-indigo-700',
};

export const AdminActivityLogsPage: React.FC = () => {
  const { profile, configuredCollege } = useAuth();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  const targetCollegeId = profile?.college_id || configuredCollege?.id;

  const fetchLogs = async () => {
    if (!isSupabaseConfigured() || !targetCollegeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, entity_type, entity_id, actor_id, metadata, created_at, actor:profiles!actor_id(full_name, email)')
        .eq('college_id', targetCollegeId)
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) {
        const fallback = await supabase
          .from('activity_logs')
          .select('id, action, entity_type, entity_id, actor_id, metadata, created_at')
          .eq('college_id', targetCollegeId)
          .order('created_at', { ascending: false })
          .limit(150);

        if (fallback.error) {
          showToast({
            type: 'error',
            title: 'Activity Logs Error',
            message: fallback.error.message,
          });
          return;
        }
        setLogs((fallback.data as ActivityLogRow[]) || []);
        return;
      }

      const normalized = (data || []).map((row: any) => ({
        ...row,
        actor: Array.isArray(row.actor) ? row.actor[0] : row.actor,
      }));
      setLogs(normalized);
    } catch (err: any) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [targetCollegeId]);

  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== 'ALL' && (log.entity_type || '').toUpperCase() !== entityFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const metaString = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : '';
      return (
        (log.action || '').toLowerCase().includes(q) ||
        (log.entity_type || '').toLowerCase().includes(q) ||
        (log.actor?.full_name || '').toLowerCase().includes(q) ||
        (log.actor?.email || '').toLowerCase().includes(q) ||
        metaString.includes(q)
      );
    }
    return true;
  });

  const formatMetadata = (meta?: Record<string, any> | null) => {
    if (!meta || Object.keys(meta).length === 0) return '—';
    const safeKeys = ['item_name', 'target_email', 'new_role', 'range', 'recipient', 'reason', 'office_location'];
    const parts: string[] = [];
    safeKeys.forEach((k) => {
      if (meta[k] !== undefined && meta[k] !== null && meta[k] !== '') {
        parts.push(`${k.replace(/_/g, ' ')}: ${String(meta[k])}`);
      }
    });
    if (parts.length > 0) return parts.join(' · ');
    return Object.entries(meta)
      .slice(0, 3)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  };

  return (
    <div className="w-full space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Activity Logs</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchLogs}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2.5">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search action, actor, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Entities' },
              { value: 'ITEM', label: 'Items' },
              { value: 'CLAIM', label: 'Claims' },
              { value: 'PROFILE', label: 'Profiles' },
              { value: 'COLLEGE', label: 'Settings & Exports' },
              { value: 'ITEM_MATCH', label: 'Matches' },
            ]}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading activity logs..." />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            className="border-0 rounded-none"
            title="No activity logs"
            icon={<Activity className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => {
                  const badgeClass = ACTION_BADGE_COLORS[log.action] || 'bg-slate-100 text-slate-700';
                  const formattedAction = (log.action || 'EVENT')
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 tabular-nums">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${badgeClass}`}
                        >
                          {formattedAction}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">
                          {log.actor?.full_name || log.actor?.email || 'System'}
                        </span>
                      </td>
                      <td
                        className="py-3 px-4 text-slate-500 max-w-md truncate"
                        title={formatMetadata(log.metadata)}
                      >
                        {formatMetadata(log.metadata)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
