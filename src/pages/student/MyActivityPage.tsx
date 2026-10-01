import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { 
  FileText, 
  ShieldCheck, 
  PlusCircle, 
  Loader2,
  Clock
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Item, Claim } from '../../types';

interface ClaimWithItem extends Claim {
  items?: Item;
}

export const MyActivityPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'CLAIMS'>('REPORTS');

  const [myReports, setMyReports] = useState<Item[]>([]);
  const [myClaims, setMyClaims] = useState<ClaimWithItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadActivity() {
      if (!user || !isSupabaseConfigured()) {
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        // Fetch items submitted by the user
        const { data: reportsData, error: reportsError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Fetch claims submitted by the user, joining the corresponding item info
        const { data: claimsData, error: claimsError } = await supabase
          .from('claims')
          .select('*, items(*)')
          .eq('claimant_id', user.id)
          .order('created_at', { ascending: false });

        if (isMounted) {
          if (!reportsError && reportsData) {
            setMyReports(
              reportsData.map((r: any) => ({
                ...r,
                type: (r.type || 'LOST').toUpperCase(),
                status: (r.status || 'PENDING').toUpperCase(),
              })) as Item[]
            );
          }

          if (!claimsError && claimsData) {
            setMyClaims(
              claimsData.map((c: any) => ({
                ...c,
                status: (c.status || 'PENDING').toUpperCase(),
                items: c.items ? {
                  ...c.items,
                  type: (c.items.type || 'LOST').toUpperCase(),
                  status: (c.items.status || 'PENDING').toUpperCase(),
                } : undefined
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

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Activity</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track your submitted lost/found reports and verification claim milestones
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/student/report-lost')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            New Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 max-w-md">
        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
            activeTab === 'REPORTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Reports ({myReports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CLAIMS')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
            activeTab === 'CLAIMS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>My Claims ({myClaims.length})</span>
        </button>
      </div>

      {isFetching ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium">Loading your activity history...</span>
        </div>
      ) : (
        <>
          {/* Tab Content: Reports */}
          {activeTab === 'REPORTS' && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
              {myReports.length === 0 ? (
                <EmptyState
                  title="No reports submitted yet"
                  description="You haven't logged any lost belongings or found items. When you submit a report, its review and match status will appear here."
                  icon={<FileText className="w-8 h-8 text-slate-400" />}
                  actionLabel="Report Lost Item"
                  onAction={() => navigate('/student/report-lost')}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-3 px-3">Item</th>
                        <th className="pb-3 px-3">Type</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3">Date</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {myReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-3 text-slate-900">
                            <span className="font-semibold block">{report.item_name}</span>
                            {report.status === 'REJECTED' && report.rejection_reason && (
                              <span className="text-[10px] text-rose-600 block font-medium mt-0.5 bg-rose-50/70 border border-rose-100 px-2 py-0.5 rounded-lg w-fit">
                                Rejection Reason: {report.rejection_reason}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <StatusBadge status={report.type} size="sm" />
                          </td>
                          <td className="py-3.5 px-3">
                            <StatusBadge status={report.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-3 text-slate-500">{report.date}</td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => navigate(`/student/item/${report.id}`)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Claims */}
          {activeTab === 'CLAIMS' && (
            <div className="space-y-4">
              {/* ISS-03: Claim Turnaround Guidance Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-3 shadow-2xs">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-indigo-950">Campus Verification & Review Procedures</p>
                  <p className="mt-0.5 text-indigo-800 leading-relaxed">
                    Submitted claims are reviewed by college team members against confidential item marks and verification evidence. Typical response time: 24–48 hours.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
              {myClaims.length === 0 ? (
                <EmptyState
                  title="No active claims"
                  description="You have not submitted any ownership claims. If you locate an item you lost in the campus directory, you can submit a claim to initiate handover."
                  icon={<ShieldCheck className="w-8 h-8 text-slate-400" />}
                  actionLabel="Browse Campus Directory"
                  onAction={() => navigate('/student/browse')}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-3 px-3">Item Name</th>
                        <th className="pb-3 px-3">Claim Status</th>
                        <th className="pb-3 px-3">Date Submitted</th>
                        <th className="pb-3 px-3">Next Step</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {myClaims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-3 text-slate-900">
                            <span className="font-semibold block">{claim.items?.item_name || 'Item Information'}</span>
                            {claim.status === 'REJECTED' && claim.rejection_reason && (
                              <span className="text-[10px] text-rose-600 block font-medium mt-0.5 bg-rose-50/70 border border-rose-100 px-2 py-0.5 rounded-lg w-fit">
                                Rejection Reason: {claim.rejection_reason}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <StatusBadge status={claim.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-3 text-slate-500">
                            {new Date(claim.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600">
                            {claim.status === 'PENDING' && 'Awaiting Admin Verification'}
                            {claim.status === 'UNDER_REVIEW' && 'Dossier Under Review'}
                            {claim.status === 'APPROVED' && 'Approved (Preparing Handover)'}
                            {claim.status === 'HANDOVER' && 'Ready! Visit office for physical handover'}
                            {claim.status === 'COMPLETED' && 'Item Returned & Case Closed'}
                            {claim.status === 'REJECTED' && 'Claim Rejected'}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => navigate(`/student/item/${claim.item_id}`)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              View Item
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </>
      )}

      {/* Explanation of Status Pipeline */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">Recovery Status Pipeline:</p>
        <p>
          <span className="font-semibold text-slate-700">Pending</span> → <span className="font-semibold text-slate-700">Under Review</span> → <span className="font-semibold text-slate-700">Approved</span> → <span className="font-semibold text-slate-700">Ready for Handover</span> → <span className="font-semibold text-slate-700">Completed</span>
        </p>
      </div>
    </div>
  );
};
