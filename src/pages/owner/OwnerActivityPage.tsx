import React, { useState, useEffect } from 'react';
import { Activity, Building2, User, Clock, Calendar, Database, Eye } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const OwnerActivityPage: React.FC = () => {
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, colleges(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (err: any) {
      console.error('Error loading global activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Connecting to platform security telemetry..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in" id="owner-activity-root">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform-Wide Activity Audit</h1>
        <p className="text-xs text-slate-500 mt-1">
          Complete cross-college audit log of item publications, ownership claims, handovers, and security events
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        {activityLogs.length === 0 ? (
          <EmptyState
            title="No platform activity logs recorded"
            description="System activity logs across all onboarded colleges will stream into this audit trail in real time."
            icon={<Activity className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              <span>Event Details</span>
              <span>Timestamp</span>
            </div>

            <div className="divide-y divide-slate-100">
              {activityLogs.map((log) => (
                <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs first:pt-0 last:pb-0">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold tracking-wide uppercase text-[9px]">
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ''}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 pt-0.5">
                      <span className="font-semibold text-slate-800">Actor ID:</span>
                      <span className="font-mono text-slate-500">{log.actor_id || 'System'}</span>
                      {log.colleges && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{log.colleges.name} ({log.colleges.code})</span>
                          </span>
                        </>
                      )}
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-1.5 text-[10px] bg-slate-50 border border-slate-100 rounded-xl p-2.5 font-mono text-slate-600 max-w-xl">
                        <span className="font-sans font-semibold text-slate-400 uppercase tracking-wider block text-[8px] mb-1">Metadata Event Context</span>
                        <pre className="whitespace-pre-wrap truncate text-[9px]">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-slate-400 text-[10px] flex sm:flex-col sm:items-end gap-1 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
