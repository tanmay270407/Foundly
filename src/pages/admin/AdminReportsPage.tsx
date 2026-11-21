import React, { useState, useEffect } from 'react';
import {
  Inbox,
  ImageIcon,
  User,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Lock,
  Eye,
  QrCode,
  Search,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, safeUpdate } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { Textarea } from '../../components/ui/Textarea';
import { StorageTagModal } from '../../components/ui/StorageTagModal';
import { Item, CATEGORIES } from '../../types';

export interface AdminReportsPageProps {
  mode?: 'ALL' | 'LOST' | 'FOUND';
}

export const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ mode = 'ALL' }) => {
  const { profile, user, session, configuredCollege } = useAuth();
  const { search, navigate } = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'PUBLISHED' | 'RETURNED' | 'REJECTED'>(
    mode === 'ALL' ? 'PUBLISHED' : 'PENDING'
  );
  const [reports, setReports] = useState<Item[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const params = new URLSearchParams(search || window.location.search);
    return params.get('search') || '';
  });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LOST' | 'FOUND'>(mode);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    const params = new URLSearchParams(search);
    const q = params.get('search');
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [search]);

  useEffect(() => {
    setTypeFilter(mode);
    setActiveTab(mode === 'ALL' ? 'PUBLISHED' : 'PENDING');
    setSelectedReportIds([]);
  }, [mode]);

  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejectOpen, setIsBulkRejectOpen] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [selectedStorageItem, setSelectedStorageItem] = useState<Item | null>(null);
  const [isStorageTagOpen, setIsStorageTagOpen] = useState(false);

  const targetCollegeId = profile?.college_id || configuredCollege?.id;

  const fetchReports = async () => {
    if (!isSupabaseConfigured() || !targetCollegeId) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*, profiles:user_id(full_name, email)')
        .eq('college_id', targetCollegeId)
        .order('created_at', { ascending: false });

      if (error) {
        showToast({
          type: 'error',
          title: 'Error loading reports',
          message: error.message,
        });
      } else if (data) {
        const formatted = data.map((item: any) => ({
          ...item,
          type: (item.type || 'LOST').toUpperCase(),
          status: (item.status || 'PENDING').toUpperCase(),
        })) as Item[];
        setReports(formatted);
      }
    } catch (err) {
      console.error('Error in fetchReports:', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [targetCollegeId]);

  const verifyStillPending = async (itemId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('status')
        .eq('id', itemId)
        .single();
      if (error || !data) return false;
      return data.status.toLowerCase() === 'pending';
    } catch {
      return false;
    }
  };

  const handleApproveAndPublish = async () => {
    if (!selectedItem || !user || !profile) return;

    setIsApproving(true);
    try {
      const isPending = await verifyStillPending(selectedItem.id);
      if (!isPending) {
        showToast({
          type: 'error',
          title: 'Already Reviewed',
          message: 'This report has already been updated by another administrator.',
        });
        setIsApproveOpen(false);
        setIsDetailsOpen(false);
        setSelectedItem(null);
        fetchReports();
        return;
      }

      const timestamp = new Date().toISOString();

      const { error } = await safeUpdate('items', 'id', selectedItem.id, {
        status: 'published',
        reviewed_by: user.id,
        reviewed_at: timestamp,
      });

      if (error) {
        showToast({
          type: 'error',
          title: 'Approval Failed',
          message: error.message,
        });
        return;
      }

      try {
        await supabase.from('notifications').insert({
          user_id: selectedItem.user_id,
          college_id: selectedItem.college_id,
          title: 'Your report has been approved and published.',
          message: `Your campus listing for "${selectedItem.item_name}" has been approved and is now live in the browse directory.`,
          type: `REPORT_APPROVED:${selectedItem.id}`,
          read: false,
        });
      } catch (notifErr) {
        console.warn('Notification insert skipped:', notifErr);
      }

      if (session?.access_token) {
        const approvedName = selectedItem.item_name;
        fetch('/api/match/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ itemId: selectedItem.id }),
        })
          .then((res) => res.json().catch(() => null))
          .then((matchData) => {
            if (matchData?.matchesCreated > 0) {
              showToast({
                type: 'info',
                title: 'Potential Match Found',
                message: `Identified ${matchData.matchesCreated} potential match${matchData.matchesCreated === 1 ? '' : 'es'} for "${approvedName}".`,
              });
            }
          })
          .catch((err) => {
            console.error('[AI Matching Trigger Error]', err);
          });
      }

      try {
        await supabase.from('activity_logs').insert({
          actor_id: user.id,
          college_id: selectedItem.college_id,
          action: 'REPORT_APPROVED',
          entity_type: 'ITEM',
          entity_id: selectedItem.id,
          metadata: {
            item_name: selectedItem.item_name,
            reviewer_email: profile.email,
          },
        });
      } catch (logErr) {
        console.warn('Activity log insert skipped:', logErr);
      }

      showToast({
        type: 'success',
        title: 'Report Published',
        message: `"${selectedItem.item_name}" is now live.`,
      });

      setIsApproveOpen(false);
      setIsDetailsOpen(false);
      setSelectedItem(null);
      fetchReports();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Approval Error',
        message: err.message || 'Could not approve report.',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !user || !profile) return;

    setIsRejecting(true);
    try {
      const isPending = await verifyStillPending(selectedItem.id);
      if (!isPending) {
        showToast({
          type: 'error',
          title: 'Already Reviewed',
          message: 'This report has already been updated by another administrator.',
        });
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        setSelectedItem(null);
        fetchReports();
        return;
      }

      const timestamp = new Date().toISOString();

      const { error } = await safeUpdate('items', 'id', selectedItem.id, {
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: timestamp,
        rejection_reason: rejectionReason.trim() || null,
      });

      if (error) {
        showToast({
          type: 'error',
          title: 'Rejection Failed',
          message: error.message,
        });
        return;
      }

      const reasonMsg = rejectionReason.trim()
        ? ` Reason provided: "${rejectionReason.trim()}".`
        : ' It did not pass validation guidelines.';
      try {
        await supabase.from('notifications').insert({
          user_id: selectedItem.user_id,
          college_id: selectedItem.college_id,
          title: 'Your report was rejected.',
          message: `Your report for "${selectedItem.item_name}" was rejected by your campus administrator.${reasonMsg}`,
          type: `REPORT_REJECTED:${selectedItem.id}`,
          read: false,
        });
      } catch (notifErr) {
        console.warn('Notification insert skipped:', notifErr);
      }

      try {
        await supabase.from('activity_logs').insert({
          actor_id: user.id,
          college_id: selectedItem.college_id,
          action: 'REPORT_REJECTED',
          entity_type: 'ITEM',
          entity_id: selectedItem.id,
          metadata: {
            item_name: selectedItem.item_name,
            rejection_reason: rejectionReason.trim() || undefined,
            reviewer_email: profile.email,
          },
        });
      } catch (logErr) {
        console.warn('Activity log insert skipped:', logErr);
      }

      showToast({
        type: 'success',
        title: 'Report Rejected',
        message: `"${selectedItem.item_name}" marked as rejected.`,
      });

      setIsRejectOpen(false);
      setRejectionReason('');
      setIsDetailsOpen(false);
      setSelectedItem(null);
      fetchReports();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Rejection Error',
        message: err.message || 'Could not reject report.',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedReportIds.length === 0 || !user || !profile) return;
    setIsBulkApproving(true);
    try {
      const timestamp = new Date().toISOString();
      const approvedItems = reports.filter((r) => selectedReportIds.includes(r.id));
      let successCount = 0;
      let failCount = 0;

      for (const item of approvedItems) {
        const { error: updateErr } = await safeUpdate('items', 'id', item.id, {
          status: 'published',
          reviewed_by: user.id,
          reviewed_at: timestamp,
        });

        if (updateErr) {
          console.error(`Bulk approve failed for item ${item.id}:`, updateErr);
          failCount++;
          continue;
        }

        successCount++;

        try {
          await supabase.from('notifications').insert({
            user_id: item.user_id,
            college_id: item.college_id,
            title: 'Your report has been approved and published.',
            message: `Your campus listing for "${item.item_name}" has been approved and is now live in the browse directory.`,
            type: `REPORT_APPROVED:${item.id}`,
            read: false,
          });
        } catch (notifErr) {
          console.warn('Notification insert skipped:', notifErr);
        }

        if (session?.access_token) {
          fetch('/api/match/trigger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ itemId: item.id }),
          }).catch((err) => {
            console.error('[AI Matching Trigger Error]', err);
          });
        }

        try {
          await supabase.from('activity_logs').insert({
            actor_id: user.id,
            college_id: item.college_id,
            action: 'REPORT_APPROVED_BULK',
            entity_type: 'ITEM',
            entity_id: item.id,
            metadata: {
              item_name: item.item_name,
              reviewer_email: profile.email,
            },
          });
        } catch (logErr) {
          console.warn('Activity log insert skipped:', logErr);
        }
      }

      if (successCount > 0 && failCount === 0) {
        showToast({
          type: 'success',
          title: 'Approved',
          message: `Published ${successCount} report${successCount === 1 ? '' : 's'}.`,
        });
      } else if (successCount > 0 && failCount > 0) {
        showToast({
          type: 'info',
          title: 'Partial Approval',
          message: `Approved ${successCount}, failed ${failCount}.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Bulk Approval Failed',
          message: 'Could not approve selected reports.',
        });
      }

      setSelectedReportIds([]);
      fetchReports();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Bulk Action Failed',
        message: err.message,
      });
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleBulkReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReportIds.length === 0 || !user || !profile) return;
    setIsBulkRejecting(true);
    try {
      const timestamp = new Date().toISOString();
      const rejectedItems = reports.filter((r) => selectedReportIds.includes(r.id));
      let successCount = 0;
      let failCount = 0;

      for (const item of rejectedItems) {
        const { error: updateErr } = await safeUpdate('items', 'id', item.id, {
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: timestamp,
          rejection_reason: bulkRejectionReason.trim() || null,
        });

        if (updateErr) {
          console.error(`Bulk reject failed for item ${item.id}:`, updateErr);
          failCount++;
          continue;
        }

        successCount++;

        try {
          await supabase.from('notifications').insert({
            user_id: item.user_id,
            college_id: item.college_id,
            title: 'Your report was rejected.',
            message: `Your report for "${item.item_name}" was rejected by your campus administrator. Reason: ${
              bulkRejectionReason.trim() || 'Did not meet moderation guidelines.'
            }`,
            type: `REPORT_REJECTED:${item.id}`,
            read: false,
          });
        } catch (notifErr) {
          console.warn('Notification insert skipped:', notifErr);
        }

        try {
          await supabase.from('activity_logs').insert({
            actor_id: user.id,
            college_id: item.college_id,
            action: 'REPORT_REJECTED_BULK',
            entity_type: 'ITEM',
            entity_id: item.id,
            metadata: {
              item_name: item.item_name,
              rejection_reason: bulkRejectionReason.trim() || undefined,
              reviewer_email: profile.email,
            },
          });
        } catch (logErr) {
          console.warn('Activity log insert skipped:', logErr);
        }
      }

      if (successCount > 0 && failCount === 0) {
        showToast({
          type: 'success',
          title: 'Rejected',
          message: `Rejected ${successCount} report${successCount === 1 ? '' : 's'}.`,
        });
      } else if (successCount > 0 && failCount > 0) {
        showToast({
          type: 'info',
          title: 'Partial Rejection',
          message: `Rejected ${successCount}, failed ${failCount}.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Bulk Rejection Failed',
          message: 'Could not reject selected reports.',
        });
      }

      setIsBulkRejectOpen(false);
      setBulkRejectionReason('');
      setSelectedReportIds([]);
      fetchReports();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Bulk Action Failed',
        message: err.message,
      });
    } finally {
      setIsBulkRejecting(false);
    }
  };

  const modeScopedReports = reports.filter((r) => (mode === 'ALL' ? true : r.type === mode));

  const filteredReports = modeScopedReports.filter((r) => {
    if (activeTab === 'PENDING' && r.status !== 'PENDING') return false;
    if (activeTab === 'PUBLISHED' && !(r.status === 'PUBLISHED' || r.status === 'APPROVED' || r.status === 'HANDOVER'))
      return false;
    if (activeTab === 'RETURNED' && !(r.status === 'RETURNED' || r.status === 'CLOSED')) return false;
    if (activeTab === 'REJECTED' && r.status !== 'REJECTED') return false;

    if (mode === 'ALL' && typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const profileObj = (r as any).profiles;
      const reporterName =
        (Array.isArray(profileObj) ? profileObj[0]?.full_name : profileObj?.full_name) || '';
      const reporterEmail =
        (Array.isArray(profileObj) ? profileObj[0]?.email : profileObj?.email) || '';
      const matchesName = (r.item_name || '').toLowerCase().includes(q);
      const matchesId = (r.id || '').toLowerCase().includes(q);
      const matchesLoc = (r.location || '').toLowerCase().includes(q);
      const matchesReporter =
        reporterName.toLowerCase().includes(q) || reporterEmail.toLowerCase().includes(q);
      if (!matchesName && !matchesId && !matchesLoc && !matchesReporter) return false;
    }

    return true;
  });

  const toggleSelectAll = () => {
    if (selectedReportIds.length === filteredReports.length) {
      setSelectedReportIds([]);
    } else {
      setSelectedReportIds(filteredReports.map((r) => r.id));
    }
  };

  const toggleSelectReport = (id: string) => {
    setSelectedReportIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const pageTitle =
    mode === 'LOST'
      ? 'Lost Reports'
      : mode === 'FOUND'
      ? 'Found Reports'
      : 'All Items';

  const tabCounts = {
    PENDING: modeScopedReports.filter((r) => r.status === 'PENDING').length,
    PUBLISHED: modeScopedReports.filter(
      (r) => r.status === 'PUBLISHED' || r.status === 'APPROVED' || r.status === 'HANDOVER'
    ).length,
    RETURNED: modeScopedReports.filter((r) => r.status === 'RETURNED' || r.status === 'CLOSED').length,
    REJECTED: modeScopedReports.filter((r) => r.status === 'REJECTED').length,
  };

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{pageTitle}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/matches')}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Matches
          </Button>
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-slate-100/70 p-1">
            {(
              [
                { key: 'PENDING', label: 'Pending' },
                { key: 'PUBLISHED', label: 'Published' },
                { key: 'RETURNED', label: 'Returned' },
                { key: 'REJECTED', label: 'Rejected' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedReportIds([]);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors tabular-nums ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label} ({tabCounts[tab.key]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2.5">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search item, location, or reporter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {mode === 'ALL' && (
            <div className="w-full sm:w-36">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                options={[
                  { value: 'ALL', label: 'All Types' },
                  { value: 'LOST', label: 'Lost' },
                  { value: 'FOUND', label: 'Found' },
                ]}
              />
            </div>
          )}
          <div className="w-full sm:w-44">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                ...CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {activeTab === 'PENDING' && selectedReportIds.length > 0 && (
        <div className="bg-slate-900 text-white py-2.5 px-4 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <span className="text-xs font-medium tabular-nums">
            {selectedReportIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => setIsBulkRejectOpen(true)}
              isLoading={isBulkRejecting}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkApprove}
              isLoading={isBulkApproving}
            >
              Approve ({selectedReportIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isFetching ? (
          <LoadingState message="Loading reports..." />
        ) : filteredReports.length === 0 ? (
          <EmptyState
            className="border-0 rounded-none"
            title={`No ${activeTab.toLowerCase()} reports`}
            icon={<Inbox className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                  {activeTab === 'PENDING' && (
                    <th className="py-2.5 px-3 w-9">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-indigo-600"
                        title="Select all"
                      >
                        {selectedReportIds.length > 0 &&
                        selectedReportIds.length === filteredReports.length ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="py-2.5 px-4">Item</th>
                  {mode === 'ALL' && <th className="py-2.5 px-4">Type</th>}
                  <th className="py-2.5 px-4">Location</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Reporter</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReports.map((report) => {
                  const profileObj = (report as any).profiles;
                  const reporterName = Array.isArray(profileObj)
                    ? profileObj[0]?.full_name
                    : profileObj?.full_name || 'Student';

                  const isSelected = selectedReportIds.includes(report.id);

                  return (
                    <tr
                      key={report.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {activeTab === 'PENDING' && (
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectReport(report.id)}
                            className="text-slate-400 hover:text-indigo-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
                            {report.image_path ? (
                              <img
                                src={report.image_path}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{report.item_name}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {(report.category || 'OTHER').replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      {mode === 'ALL' && (
                        <td className="py-3 px-4">
                          <StatusBadge status={report.type} size="sm" />
                        </td>
                      )}
                      <td className="py-3 px-4 text-slate-600 max-w-[160px] truncate">
                        {report.location}
                      </td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {report.date}
                      </td>
                      <td className="py-3 px-4 text-slate-700 truncate max-w-[140px]">
                        {reporterName}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {report.type === 'FOUND' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<QrCode className="w-3.5 h-3.5 text-slate-500" />}
                              onClick={() => {
                                setSelectedStorageItem(report);
                                setIsStorageTagOpen(true);
                              }}
                              title="Print storage tag"
                            >
                              Tag
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setSelectedItem(report);
                              setIsDetailsOpen(true);
                            }}
                          >
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedItem && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedItem(null);
          }}
          title={selectedItem.item_name}
          maxWidth="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="aspect-video md:aspect-auto rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              {selectedItem.image_path ? (
                <img
                  src={selectedItem.image_path}
                  alt={selectedItem.item_name}
                  className="w-full h-full max-h-[260px] object-contain rounded"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate-400">
                  <ImageIcon className="w-8 h-8 stroke-1" />
                  <span className="text-xs">No photo</span>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                <StatusBadge status={selectedItem.type} size="sm" />
                <StatusBadge status={selectedItem.status} size="sm" />
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block">Category</span>
                  <span className="font-medium text-slate-900">
                    {(selectedItem.category || 'OTHER').replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Date</span>
                  <span className="font-medium text-slate-900 inline-flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {selectedItem.date}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Location</span>
                  <span className="font-medium text-slate-900 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {selectedItem.location}
                  </span>
                </div>
                {selectedItem.approximate_time && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Approximate Time</span>
                    <span className="font-medium text-slate-900 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {selectedItem.approximate_time}
                    </span>
                  </div>
                )}
                {selectedItem.brand && (
                  <div>
                    <span className="text-slate-400 block">Brand</span>
                    <span className="font-medium text-slate-900">{selectedItem.brand}</span>
                  </div>
                )}
                {selectedItem.color && (
                  <div>
                    <span className="text-slate-400 block">Color</span>
                    <span className="font-medium text-slate-900">{selectedItem.color}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Description</span>
                <p className="text-slate-700 leading-relaxed">{selectedItem.description}</p>
              </div>

              {selectedItem.unique_marks && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-lg">
                  <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 mb-1">
                    <Lock className="w-3 h-3" />
                    Private Verification Marks
                  </p>
                  <p className="text-amber-950 font-mono text-[11px] leading-relaxed">
                    {selectedItem.unique_marks}
                  </p>
                </div>
              )}

              {(() => {
                const rawProfile = (selectedItem as any).profiles;
                const reporterProfile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
                return (
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <span className="text-slate-400 block">Reporter</span>
                    <p className="flex items-center gap-1.5 font-medium text-slate-900">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{reporterProfile?.full_name || 'Student'}</span>
                    </p>
                    {reporterProfile?.email && (
                      <p className="flex items-center gap-1.5 text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{reporterProfile.email}</span>
                      </p>
                    )}
                  </div>
                );
              })()}

              {selectedItem.status !== 'PENDING' && (
                <div className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-lg space-y-1">
                  {selectedItem.rejection_reason && (
                    <p className="text-rose-700 font-medium">
                      Reason: {selectedItem.rejection_reason}
                    </p>
                  )}
                  <p className="text-slate-500 tabular-nums">
                    Reviewed:{' '}
                    {selectedItem.reviewed_at
                      ? new Date(selectedItem.reviewed_at).toLocaleString()
                      : '—'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {selectedItem.status === 'PENDING' && (
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
              <Button variant="danger" size="sm" onClick={() => setIsRejectOpen(true)}>
                Reject
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsApproveOpen(true)}>
                Approve &amp; Publish
              </Button>
            </div>
          )}
        </Modal>
      )}

      <ConfirmationDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApproveAndPublish}
        title="Publish report?"
        message={`Approve and publish "${selectedItem?.item_name || 'this report'}" to the campus catalog?`}
        confirmLabel="Publish"
        isLoading={isApproving}
      />

      {selectedItem && (
        <Modal
          isOpen={isRejectOpen}
          onClose={() => {
            setIsRejectOpen(false);
            setRejectionReason('');
          }}
          title="Reject report"
          maxWidth="sm"
        >
          <form onSubmit={handleReject} className="space-y-4">
            <Textarea
              label="Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this report is rejected..."
              rows={3}
              requiredIndicator
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRejectOpen(false);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isRejecting}>
                Reject
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        isOpen={isBulkRejectOpen}
        onClose={() => {
          setIsBulkRejectOpen(false);
          setBulkRejectionReason('');
        }}
        title={`Reject ${selectedReportIds.length} reports`}
        maxWidth="sm"
      >
        <form onSubmit={handleBulkReject} className="space-y-4">
          <Textarea
            label="Reason"
            value={bulkRejectionReason}
            onChange={(e) => setBulkRejectionReason(e.target.value)}
            placeholder="Reason sent to reporters..."
            rows={3}
            requiredIndicator
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsBulkRejectOpen(false);
                setBulkRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" isLoading={isBulkRejecting}>
              Reject All
            </Button>
          </div>
        </form>
      </Modal>

      {selectedStorageItem && (
        <StorageTagModal
          isOpen={isStorageTagOpen}
          onClose={() => {
            setIsStorageTagOpen(false);
            setSelectedStorageItem(null);
          }}
          item={selectedStorageItem}
          collegeName={configuredCollege?.name || profile?.college_id || undefined}
          onUpdateStorageLocation={() => {
            fetchReports();
          }}
        />
      )}
    </div>
  );
};
