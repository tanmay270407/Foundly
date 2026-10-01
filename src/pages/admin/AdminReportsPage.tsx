import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Inbox, 
  Loader2, 
  ImageIcon, 
  User, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Lock,
  Eye,
  Filter,
  QrCode,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { Textarea } from '../../components/ui/Textarea';
import { StorageTagModal } from '../../components/ui/StorageTagModal';
import { Item, CATEGORIES } from '../../types';

export const AdminReportsPage: React.FC = () => {
  const { profile, user, session } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'PUBLISHED' | 'REJECTED'>('PENDING');
  const [reports, setReports] = useState<Item[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LOST' | 'FOUND'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Bulk Operations State
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejectOpen, setIsBulkRejectOpen] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);

  // Modals / Dialog States
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Approval confirmation
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Rejection reason modal
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Storage Tag Modal State
  const [selectedStorageItem, setSelectedStorageItem] = useState<Item | null>(null);
  const [isStorageTagOpen, setIsStorageTagOpen] = useState(false);

  // Load college reports
  const fetchReports = async () => {
    if (!isSupabaseConfigured() || !profile?.college_id) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*, profiles:user_id(full_name, email)')
        .eq('college_id', profile.college_id)
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
  }, [profile?.college_id]);

  // Concurrency Check helper
  const verifyStillPending = async (itemId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('status')
        .eq('id', itemId)
        .single();
      
      if (error || !data) return false;
      return data.status.toLowerCase() === 'pending';
    } catch (e) {
      return false;
    }
  };

  const handleApproveAndPublish = async () => {
    if (!selectedItem || !user || !profile) return;

    setIsApproving(true);
    try {
      // 1. Concurrency Check: re-verify report is still pending
      const isPending = await verifyStillPending(selectedItem.id);
      if (!isPending) {
        showToast({
          type: 'error',
          title: 'Review Collision',
          message: 'This report has already been reviewed or updated by another administrator.',
        });
        setIsApproveOpen(false);
        setIsDetailsOpen(false);
        setSelectedItem(null);
        fetchReports();
        return;
      }

      const timestamp = new Date().toISOString();

      // 2. Perform DB update
      const { error } = await supabase
        .from('items')
        .update({
          status: 'published',
          reviewed_by: user.id,
          reviewed_at: timestamp
        })
        .eq('id', selectedItem.id);

      if (error) {
        showToast({
          type: 'error',
          title: 'Approval Failed',
          message: error.message,
        });
        return;
      }

      // 3. Create Real-time Notification for reporter
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedItem.user_id,
          college_id: selectedItem.college_id,
          title: 'Your report has been approved and published.',
          message: `Your campus listing for "${selectedItem.item_name}" has been approved and is now live in the browse directory.`,
          type: `REPORT_APPROVED:${selectedItem.id}`,
          read: false
        });

      // 3.5 Trigger AI matching in the background
      fetch('/api/match/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ itemId: selectedItem.id })
      }).then(res => res.json())
        .then(data => {
          console.log('[AI Matching Triggered]', data);
        })
        .catch(err => {
          console.error('[AI Matching Trigger Error]', err);
        });

      // 4. Log activity
      await supabase
        .from('activity_logs')
        .insert({
          actor_id: user.id,
          college_id: selectedItem.college_id,
          action: 'REPORT_APPROVED',
          entity_type: 'ITEM',
          entity_id: selectedItem.id,
          metadata: { 
            item_name: selectedItem.item_name,
            reviewer_email: profile.email
          }
        });

      showToast({
        type: 'success',
        title: 'Report Approved',
        message: `"${selectedItem.item_name}" has been published successfully.`,
      });

      // Close panels & reset
      setIsApproveOpen(false);
      setIsDetailsOpen(false);
      setSelectedItem(null);
      fetchReports();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Unexpected Error',
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
      // 1. Concurrency Check
      const isPending = await verifyStillPending(selectedItem.id);
      if (!isPending) {
        showToast({
          type: 'error',
          title: 'Review Collision',
          message: 'This report has already been reviewed or updated by another administrator.',
        });
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        setSelectedItem(null);
        fetchReports();
        return;
      }

      const timestamp = new Date().toISOString();

      // 2. Perform DB update
      const { error } = await supabase
        .from('items')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: timestamp,
          rejection_reason: rejectionReason.trim() || null
        })
        .eq('id', selectedItem.id);

      if (error) {
        showToast({
          type: 'error',
          title: 'Rejection Failed',
          message: error.message,
        });
        return;
      }

      // 3. Create Notification
      const reasonMsg = rejectionReason.trim() 
        ? ` Reason provided: "${rejectionReason.trim()}".` 
        : ' It did not pass validation guidelines.';
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedItem.user_id,
          college_id: selectedItem.college_id,
          title: 'Your report was rejected.',
          message: `Your report for "${selectedItem.item_name}" was rejected by your campus administrator.${reasonMsg}`,
          type: `REPORT_REJECTED:${selectedItem.id}`,
          read: false
        });

      // 4. Log Activity
      await supabase
        .from('activity_logs')
        .insert({
          actor_id: user.id,
          college_id: selectedItem.college_id,
          action: 'REPORT_REJECTED',
          entity_type: 'ITEM',
          entity_id: selectedItem.id,
          metadata: { 
            item_name: selectedItem.item_name,
            rejection_reason: rejectionReason.trim() || undefined,
            reviewer_email: profile.email
          }
        });

      showToast({
        type: 'success',
        title: 'Report Rejected',
        message: `"${selectedItem.item_name}" has been marked as REJECTED.`,
      });

      setIsRejectOpen(false);
      setRejectionReason('');
      setIsDetailsOpen(false);
      setSelectedItem(null);
      fetchReports();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Unexpected Error',
        message: err.message || 'Could not reject report.',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Bulk Approve Handlers
  const handleBulkApprove = async () => {
    if (selectedReportIds.length === 0 || !user || !profile) return;
    setIsBulkApproving(true);
    try {
      const timestamp = new Date().toISOString();
      const approvedItems = reports.filter(r => selectedReportIds.includes(r.id));

      for (const item of approvedItems) {
        await supabase
          .from('items')
          .update({
            status: 'published',
            reviewed_by: user.id,
            reviewed_at: timestamp
          })
          .eq('id', item.id);

        await supabase
          .from('notifications')
          .insert({
            user_id: item.user_id,
            college_id: item.college_id,
            title: 'Your report has been approved and published.',
            message: `Your campus listing for "${item.item_name}" has been approved and is now live in the browse directory.`,
            type: `REPORT_APPROVED:${item.id}`,
            read: false
          });

        await supabase
          .from('activity_logs')
          .insert({
            actor_id: user.id,
            college_id: item.college_id,
            action: 'REPORT_APPROVED_BULK',
            entity_type: 'ITEM',
            entity_id: item.id,
            metadata: { 
              item_name: item.item_name,
              reviewer_email: profile.email
            }
          });
      }

      showToast({
        type: 'success',
        title: 'Bulk Approval Complete',
        message: `Successfully approved ${selectedReportIds.length} reports.`,
      });

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

  // Bulk Reject Handlers
  const handleBulkReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReportIds.length === 0 || !user || !profile) return;
    setIsBulkRejecting(true);
    try {
      const timestamp = new Date().toISOString();
      const rejectedItems = reports.filter(r => selectedReportIds.includes(r.id));

      for (const item of rejectedItems) {
        await supabase
          .from('items')
          .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: timestamp,
            rejection_reason: bulkRejectionReason.trim() || null
          })
          .eq('id', item.id);

        await supabase
          .from('notifications')
          .insert({
            user_id: item.user_id,
            college_id: item.college_id,
            title: 'Your report was rejected.',
            message: `Your report for "${item.item_name}" was rejected by your campus administrator. Reason: ${bulkRejectionReason.trim() || 'Did not meet moderation guidelines.'}`,
            type: `REPORT_REJECTED:${item.id}`,
            read: false
          });

        await supabase
          .from('activity_logs')
          .insert({
            actor_id: user.id,
            college_id: item.college_id,
            action: 'REPORT_REJECTED_BULK',
            entity_type: 'ITEM',
            entity_id: item.id,
            metadata: { 
              item_name: item.item_name,
              rejection_reason: bulkRejectionReason.trim() || undefined,
              reviewer_email: profile.email
            }
          });
      }

      showToast({
        type: 'success',
        title: 'Bulk Rejection Complete',
        message: `Rejected ${selectedReportIds.length} reports.`,
      });

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

  // Filter reports according to current tab, filters, and search
  const filteredReports = reports.filter((r) => {
    if (activeTab === 'PENDING' && r.status !== 'PENDING') return false;
    if (activeTab === 'PUBLISHED' && !(r.status === 'PUBLISHED' || r.status === 'APPROVED')) return false;
    if (activeTab === 'REJECTED' && r.status !== 'REJECTED') return false;

    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const profileObj = (r as any).profiles;
      const reporterName = (Array.isArray(profileObj) ? profileObj[0]?.full_name : profileObj?.full_name) || '';
      const reporterEmail = (Array.isArray(profileObj) ? profileObj[0]?.email : profileObj?.email) || '';
      const matchesName = r.item_name.toLowerCase().includes(q);
      const matchesId = r.id.toLowerCase().includes(q);
      const matchesLoc = r.location.toLowerCase().includes(q);
      const matchesReporter = reporterName.toLowerCase().includes(q) || reporterEmail.toLowerCase().includes(q);
      if (!matchesName && !matchesId && !matchesLoc && !matchesReporter) return false;
    }

    return true;
  });

  const toggleSelectAll = () => {
    if (selectedReportIds.length === filteredReports.length) {
      setSelectedReportIds([]);
    } else {
      setSelectedReportIds(filteredReports.map(r => r.id));
    }
  };

  const toggleSelectReport = (id: string) => {
    setSelectedReportIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campus Reports Review</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review, verify, and moderate student-submitted lost and found reports to maintain campus security
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 max-w-md">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'PENDING'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Pending ({reports.filter(r => r.status === 'PENDING').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PUBLISHED')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'PUBLISHED'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Published ({reports.filter(r => r.status === 'PUBLISHED' || r.status === 'APPROVED').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'REJECTED'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Rejected ({reports.filter(r => r.status === 'REJECTED').length})</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Input
            placeholder="Search by item name, ID, location, or reporter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            options={[
              { value: 'ALL', label: 'All Types' },
              { value: 'LOST', label: 'Lost Items' },
              { value: 'FOUND', label: 'Found Items' }
            ]}
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              ...CATEGORIES.map(c => ({ value: c, label: c.replace(/_/g, ' ') }))
            ]}
          />
        </div>
      </div>

      {/* Bulk Action Bar (When reports selected in Pending tab) */}
      {activeTab === 'PENDING' && selectedReportIds.length > 0 && (
        <div className="bg-indigo-900 text-white p-3.5 px-5 rounded-2xl shadow-md flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckSquare className="w-4 h-4 text-indigo-300" />
            <span><strong>{selectedReportIds.length}</strong> reports selected for bulk moderation</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => setIsBulkRejectOpen(true)}
              isLoading={isBulkRejecting}
            >
              Reject Selected ({selectedReportIds.length})
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkApprove}
              isLoading={isBulkApproving}
            >
              Approve & Publish Selected ({selectedReportIds.length})
            </Button>
          </div>
        </div>
      )}

      {isFetching ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium">Fetching reports queue...</span>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs animate-fade-in">
          {filteredReports.length === 0 ? (
            <EmptyState
              title={`No ${activeTab.toLowerCase()} reports`}
              description={`There are currently no items matching the ${activeTab.toLowerCase()} moderation pool or filter criteria.`}
              icon={<Inbox className="w-8 h-8 text-slate-400" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                    {activeTab === 'PENDING' && (
                      <th className="pb-3 px-3 w-8">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-slate-400 hover:text-indigo-600"
                          title="Select / Deselect All"
                        >
                          {selectedReportIds.length > 0 && selectedReportIds.length === filteredReports.length ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="pb-3 px-3">Item</th>
                    <th className="pb-3 px-3">Type</th>
                    <th className="pb-3 px-3">Category</th>
                    <th className="pb-3 px-3">Date</th>
                    <th className="pb-3 px-3">Location</th>
                    <th className="pb-3 px-3">Reporter</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredReports.map((report) => {
                    const profileObj = (report as any).profiles;
                    const reporterName = Array.isArray(profileObj) 
                      ? profileObj[0]?.full_name 
                      : profileObj?.full_name || 'Anonymous Student';

                    const isSelected = selectedReportIds.includes(report.id);

                    return (
                      <tr key={report.id} className={`hover:bg-slate-50/50 ${isSelected ? 'bg-indigo-50/20' : ''}`}>
                        {activeTab === 'PENDING' && (
                          <td className="py-3.5 px-3">
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
                        <td className="py-3.5 px-3 font-semibold text-slate-900 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {report.image_path ? (
                              <img src={report.image_path} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <span>{report.item_name}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <StatusBadge status={report.type} size="sm" />
                        </td>
                        <td className="py-3.5 px-3 text-slate-500">
                          {report.category.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3.5 px-3 text-slate-500">
                          {report.date}
                        </td>
                        <td className="py-3.5 px-3 text-slate-500 max-w-[120px] truncate">
                          {report.location}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">{reporterName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {report.type === 'FOUND' && (
                              <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<QrCode className="w-3.5 h-3.5 text-amber-600" />}
                                onClick={() => {
                                  setSelectedStorageItem(report);
                                  setIsStorageTagOpen(true);
                                }}
                                title="Print Physical Storage Tag"
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
      )}

      {/* Review Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedItem(null);
          }}
          title="Review Report Details"
          description="Examine item parameters and private verified information before publishing decision."
          maxWidth="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
            {/* Image panel */}
            <div className="aspect-video md:aspect-auto rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
              {selectedItem.image_path ? (
                <img
                  src={selectedItem.image_path}
                  alt={selectedItem.item_name}
                  className="w-full h-full max-h-[280px] object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate-400">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <span className="text-xs font-semibold">No photograph uploaded</span>
                </div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                <StatusBadge status={selectedItem.type} />
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>

            {/* Details panel */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-1">
                  {selectedItem.category.replace(/_/g, ' ')}
                </span>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {selectedItem.item_name}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs py-3.5 border-y border-slate-100">
                <div>
                  <span className="text-slate-400 block">Date logged:</span>
                  <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {selectedItem.date}
                  </span>
                </div>
                {selectedItem.approximate_time && (
                  <div>
                    <span className="text-slate-400 block">Approximate Time:</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {selectedItem.approximate_time}
                    </span>
                  </div>
                )}
                <div className="col-span-2 mt-1">
                  <span className="text-slate-400 block">Campus Location:</span>
                  <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedItem.location}
                  </span>
                </div>
              </div>

              {/* Private marks */}
              {selectedItem.unique_marks && (
                <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5" />
                    Confidential Marks (Verification Only)
                  </p>
                  <p className="text-xs text-rose-900 italic leading-relaxed">
                    {selectedItem.unique_marks}
                  </p>
                </div>
              )}

              {/* Public Description */}
              <div>
                <span className="text-slate-400 text-xs block mb-1">Public Description:</span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-150">
                  {selectedItem.description}
                </p>
              </div>

              {/* Brand and color */}
              {(selectedItem.brand || selectedItem.color) && (
                <div className="flex gap-4 text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-xl">
                  {selectedItem.brand && (
                    <div>
                      <strong>Brand:</strong> {selectedItem.brand}
                    </div>
                  )}
                  {selectedItem.color && (
                    <div>
                      <strong>Color:</strong> {selectedItem.color}
                    </div>
                  )}
                </div>
              )}

              {/* Reporter details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1">
                <span className="font-semibold text-slate-700 block mb-1">Reporter Contact:</span>
                <p className="flex items-center gap-2 text-slate-600">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {((selectedItem as any).profiles)?.full_name || 'Anonymous Student'}
                  </span>
                </p>
                {((selectedItem as any).profiles)?.email && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{((selectedItem as any).profiles)?.email}</span>
                  </p>
                )}
              </div>

              {/* Admin decision status details */}
              {selectedItem.status !== 'PENDING' && (
                <div className="p-3 bg-slate-100/80 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-slate-800">Moderation Log:</span>
                  {selectedItem.rejection_reason && (
                    <p className="text-rose-800 font-medium">
                      Rejection Reason: {selectedItem.rejection_reason}
                    </p>
                  )}
                  <p className="text-slate-500 text-[10px]">
                    Reviewed on {selectedItem.reviewed_at ? new Date(selectedItem.reviewed_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons at bottom of Modal details */}
          {selectedItem.status === 'PENDING' && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedItem(null);
                }}
              >
                Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsRejectOpen(true)}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsApproveOpen(true)}
                >
                  Approve & Publish
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Confirmation: Approve & Publish */}
      <ConfirmationDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApproveAndPublish}
        title="Publish this report?"
        message={`Are you sure you want to approve and publish "${selectedItem?.item_name || 'this report'}" to your campus-wide Lost & Found directory?`}
        confirmLabel="Publish"
        isLoading={isApproving}
      />

      {/* Modal: Rejection Reason */}
      {selectedItem && (
        <Modal
          isOpen={isRejectOpen}
          onClose={() => {
            setIsRejectOpen(false);
            setRejectionReason('');
          }}
          title="Reject this report?"
          description={`Please provide a validation rejection reason for "${selectedItem.item_name}". The reporter will receive this message.`}
          maxWidth="sm"
        >
          <form onSubmit={handleReject} className="space-y-4">
            <Textarea
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Inappropriate photograph, duplicate report, or details missing campus affiliation..."
              rows={3}
              requiredIndicator
            />
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
              <Button
                type="submit"
                variant="danger"
                size="sm"
                isLoading={isRejecting}
              >
                Reject Report
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Bulk Rejection Reason */}
      <Modal
        isOpen={isBulkRejectOpen}
        onClose={() => {
          setIsBulkRejectOpen(false);
          setBulkRejectionReason('');
        }}
        title="Bulk Reject Selected Reports?"
        description={`Provide a rejection reason for the ${selectedReportIds.length} selected reports. Each student reporter will receive a notification.`}
        maxWidth="sm"
      >
        <form onSubmit={handleBulkReject} className="space-y-4">
          <Textarea
            label="Bulk Rejection Reason"
            value={bulkRejectionReason}
            onChange={(e) => setBulkRejectionReason(e.target.value)}
            placeholder="e.g. Reports do not meet campus moderation guidelines..."
            rows={3}
            requiredIndicator
          />
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isBulkRejecting}
            >
              Confirm Bulk Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* Physical Storage Tag Modal */}
      {selectedStorageItem && (
        <StorageTagModal
          isOpen={isStorageTagOpen}
          onClose={() => {
            setIsStorageTagOpen(false);
            setSelectedStorageItem(null);
          }}
          item={selectedStorageItem}
          collegeName={profile?.college_id}
          onUpdateStorageLocation={(newLoc) => {
            fetchReports();
          }}
        />
      )}
    </div>
  );
};
