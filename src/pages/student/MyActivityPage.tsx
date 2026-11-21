import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  FileText,
  ShieldCheck,
  PlusCircle,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Item, Claim } from '../../types';

interface ClaimWithItem extends Claim {
  items?: Item;
}

export interface MyActivityPageProps {
  initialTab?: 'REPORTS' | 'CLAIMS';
}

export const MyActivityPage: React.FC<MyActivityPageProps> = ({ initialTab }) => {
  const { currentPath, search, navigate } = useRouter();
  const { user } = useAuth();

  const resolveTab = (): 'REPORTS' | 'CLAIMS' => {
    if (initialTab) return initialTab;
    if (currentPath === '/student/claims') return 'CLAIMS';
    const params = new URLSearchParams(search);
    if (params.get('tab')?.toUpperCase() === 'CLAIMS') return 'CLAIMS';
    return 'REPORTS';
  };

  const [activeTab, setActiveTab] = useState<'REPORTS' | 'CLAIMS'>(resolveTab);
  const [myReports, setMyReports] = useState<Item[]>([]);
  const [myClaims, setMyClaims] = useState<ClaimWithItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, [initialTab, currentPath, search]);

  useEffect(() => {
    let isMounted = true;

    async function loadActivity() {
      if (!user || !isSupabaseConfigured()) {
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        const [{ data: reportsData, error: reportsError }, { data: claimsData, error: claimsError }] =
          await Promise.all([
            supabase
              .from('items')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('claims')
              .select('*, items(*)')
              .eq('claimant_id', user.id)
              .order('created_at', { ascending: false }),
          ]);

        if (isMounted) {
          if (!reportsError && reportsData) {
            setMyReports(
              reportsData.map((r: any) => ({
                ...r,
                type: (r.type || 'FOUND').toUpperCase(),
                status: (r.status || 'PENDING').toUpperCase(),
              })) as Item[]
            );
          }

          if (!claimsError && claimsData) {
            setMyClaims(
              claimsData.map((c: any) => ({
                ...c,
                status: (c.status || 'PENDING').toUpperCase(),
                items: c.items
                  ? {
                      ...c.items,
                      type: (c.items.type || 'FOUND').toUpperCase(),
                      status: (c.items.status || 'PENDING').toUpperCase(),
                    }
                  : undefined,
              })) as ClaimWithItem[]
            );
          }
        }
      } catch (err) {
        console.error('Error loading student activity:', err);
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadActivity();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleTabSwitch = (tab: 'REPORTS' | 'CLAIMS') => {
    setActiveTab(tab);
    if (currentPath === '/student/reports' || currentPath === '/student/claims') {
      navigate(tab === 'REPORTS' ? '/student/reports' : '/student/claims');
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {activeTab === 'CLAIMS' ? 'My Claims' : 'My Reports'}
        </h1>

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

      {/* Segmented Tabs */}
      <div className="inline-flex rounded-lg border border-slate-200/80 bg-slate-100/70 p-0.5">
        <button
          type="button"
          onClick={() => handleTabSwitch('REPORTS')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'REPORTS'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Reports</span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">{myReports.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('CLAIMS')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'CLAIMS'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Claims</span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">{myClaims.length}</span>
        </button>
      </div>

      {isFetching ? (
        <LoadingState message="Loading..." />
      ) : activeTab === 'REPORTS' ? (
        myReports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            icon={<FileText className="w-5 h-5 text-slate-400" />}
            actionLabel="Report Lost"
            onAction={() => navigate('/student/report-lost')}
          />
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 block">{report.item_name}</span>
                        {report.status === 'REJECTED' && report.rejection_reason && (
                          <span className="text-[11px] text-rose-600 block mt-0.5">
                            {report.rejection_reason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={report.type} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={report.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums">{report.date}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/student/item/${report.id}`)}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : myClaims.length === 0 ? (
        <EmptyState
          title="No claims yet"
          icon={<ShieldCheck className="w-5 h-5 text-slate-400" />}
          actionLabel="Browse Items"
          onAction={() => navigate('/student/browse')}
        />
      ) : (
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Submitted</th>
                  <th className="py-2.5 px-4">Stage</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myClaims.map((claim) => {
                  const isLinked =
                    Boolean(claim.lost_item_id) ||
                    String(claim.additional_message || '').includes('[Linked Lost Report:');
                  return (
                    <tr key={claim.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {claim.items?.item_name || 'Item'}
                          </span>
                          {isLinked && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600"
                              title="Linked to your Lost Report"
                            >
                              <Link2 className="w-3 h-3" />
                              Linked
                            </span>
                          )}
                        </div>
                        {claim.status === 'REJECTED' && claim.rejection_reason && (
                          <span className="text-[11px] text-rose-600 block mt-0.5">
                            {claim.rejection_reason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={claim.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {claim.status === 'PENDING' && 'Pending review'}
                        {claim.status === 'UNDER_REVIEW' && 'Under review'}
                        {claim.status === 'APPROVED' && 'Approved'}
                        {claim.status === 'HANDOVER' && 'Ready for pickup'}
                        {claim.status === 'COMPLETED' && 'Returned'}
                        {claim.status === 'REJECTED' && 'Rejected'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/student/item/${claim.item_id}`)}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
