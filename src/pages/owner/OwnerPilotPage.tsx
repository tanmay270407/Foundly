import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  RefreshCw,
  Users,
  FileText,
  PackageCheck,
  CheckSquare,
  PauseCircle,
  PlayCircle,
  Target,
  MessageSquare,
  AlertTriangle,
  Download,
  Plus,
  ShieldCheck,
  Info
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { 
  getCollegePilotData, 
  saveCollegePilotData, 
  getPilotFeedbackList,
  recordPilotIssue,
  CollegePilotData, 
  PilotState,
  PilotGoals,
  PilotFeedbackItem,
  PilotIssueItem
} from '../../lib/collegePilot';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';

interface CollegePilotItem {
  college: any;
  pilotData: CollegePilotData;
}

export const OwnerPilotPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { user, profile } = useAuth();

  const [pilotItems, setPilotItems] = useState<CollegePilotItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  // Selected college for details/actions
  const [selectedCollege, setSelectedCollege] = useState<any | null>(null);
  const [selectedPilotData, setSelectedPilotData] = useState<CollegePilotData | null>(null);

  // Modals
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [isIssuesModalOpen, setIsIssuesModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Form states for Goals
  const [goalsForm, setGoalsForm] = useState<PilotGoals>({
    targetStudents: 100,
    targetReports: 25,
    targetReturns: 10,
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Form state for new Issue
  const [issueForm, setIssueForm] = useState({
    title: '',
    description: '',
    severity: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    status: 'OPEN' as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
  });

  // Feedback list for selected college
  const [feedbackList, setFeedbackList] = useState<PilotFeedbackItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadPilotData = async () => {
    if (!isSupabaseConfigured()) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const { data: colleges, error } = await supabase.from('colleges').select('*').order('name');
      if (error) throw error;

      if (colleges) {
        const items: CollegePilotItem[] = await Promise.all(
          colleges.map(async (col) => {
            const pilotData = await getCollegePilotData(col.id);
            return { college: col, pilotData };
          })
        );
        setPilotItems(items);

        // Keep selected pilot data updated if open
        if (selectedCollege) {
          const updated = items.find((i) => i.college.id === selectedCollege.id);
          if (updated) setSelectedPilotData(updated.pilotData);
        }
      }
    } catch (err: any) {
      console.error('Error loading pilot data:', err);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load college pilot data.',
      });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadPilotData();
  }, []);

  const handleStateChange = async (college: any, newState: PilotState) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const ok = await saveCollegePilotData(
        college.id,
        user.id,
        newState,
        undefined,
        undefined,
        profile?.full_name || user.email
      );

      if (ok) {
        showToast({
          type: 'success',
          title: `Pilot State Changed to ${newState}`,
          message: `Updated pilot state for ${college.name}.`,
        });
        loadPilotData();
      } else {
        throw new Error('Could not update pilot state.');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'State Update Failed',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGoals = async () => {
    if (!selectedCollege?.id || !user?.id) return;
    setIsSaving(true);
    try {
      const ok = await saveCollegePilotData(
        selectedCollege.id,
        user.id,
        selectedPilotData?.pilotState || 'NOT_STARTED',
        goalsForm,
        undefined,
        profile?.full_name || user.email
      );

      if (ok) {
        showToast({
          type: 'success',
          title: 'Pilot Operational Goals Saved',
          message: `Target benchmarks persisted for ${selectedCollege.name}.`,
        });
        setIsGoalsModalOpen(false);
        loadPilotData();
      } else {
        throw new Error('Save failed.');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!selectedCollege?.id || !user?.id || !issueForm.title.trim()) return;
    setIsSaving(true);
    try {
      const ok = await recordPilotIssue(
        selectedCollege.id,
        user.id,
        issueForm.title.trim(),
        issueForm.description.trim(),
        issueForm.severity,
        issueForm.status,
        profile?.full_name || user.email
      );

      if (ok) {
        showToast({
          type: 'success',
          title: 'Pilot Issue Recorded',
          message: `Logged issue: "${issueForm.title}"`,
        });
        setIssueForm({ title: '', description: '', severity: 'LOW', status: 'OPEN' });
        loadPilotData();
      } else {
        throw new Error('Could not record issue.');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openFeedbackModal = async (college: any) => {
    setSelectedCollege(college);
    const feedback = await getPilotFeedbackList(college.id);
    setFeedbackList(feedback);
    setIsFeedbackModalOpen(true);
  };

  const filteredItems = pilotItems.filter(({ college, pilotData }) => {
    const matchesSearch =
      college.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      college.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'ALL' || pilotData.pilotState === stateFilter;
    return matchesSearch && matchesState;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in" id="owner-pilot-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Pilot Operations & Adoption</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Real College Pilot Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Factual metrics, goal management, issue logging, and feedback reviews across active college pilots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadPilotData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/owner/rollout')}
            leftIcon={<Building2 className="w-3.5 h-3.5" />}
          >
            Rollout Dashboard
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search pilot college..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'NOT_STARTED', 'ACTIVE', 'PAUSED', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStateFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                stateFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Pilot Colleges Table */}
      {isFetching ? (
        <div className="py-20 text-center text-xs text-slate-500">Loading live pilot analytics...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
          No college pilots match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(({ college, pilotData }) => (
            <div key={college.id} className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-4">
              {/* College Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 text-base">{college.name}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                      {college.code}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      pilotData.pilotState === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : pilotData.pilotState === 'PAUSED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : pilotData.pilotState === 'COMPLETED'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      PILOT: {pilotData.pilotState}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {pilotData.startedAt
                      ? `Started: ${new Date(pilotData.startedAt).toLocaleDateString()} by ${pilotData.startedBy}`
                      : 'Pilot not started yet.'}
                  </div>
                </div>

                {/* State Control Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {pilotData.pilotState !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStateChange(college, 'ACTIVE')}
                      leftIcon={<PlayCircle className="w-3.5 h-3.5 text-emerald-600" />}
                      disabled={isSaving}
                    >
                      Start Pilot
                    </Button>
                  )}
                  {pilotData.pilotState === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStateChange(college, 'PAUSED')}
                      leftIcon={<PauseCircle className="w-3.5 h-3.5 text-rose-600" />}
                      disabled={isSaving}
                    >
                      Pause Pilot
                    </Button>
                  )}
                  {pilotData.pilotState !== 'COMPLETED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStateChange(college, 'COMPLETED')}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      disabled={isSaving}
                    >
                      Mark Complete
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCollege(college);
                      setSelectedPilotData(pilotData);
                      setGoalsForm(pilotData.goals);
                      setIsGoalsModalOpen(true);
                    }}
                    leftIcon={<Target className="w-3.5 h-3.5 text-indigo-600" />}
                  >
                    Goals
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCollege(college);
                      setSelectedPilotData(pilotData);
                      setIsIssuesModalOpen(true);
                    }}
                    leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                  >
                    Issues ({pilotData.issues.length})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFeedbackModal(college)}
                    leftIcon={<MessageSquare className="w-3.5 h-3.5 text-sky-600" />}
                  >
                    Feedback ({pilotData.feedbackCount})
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedCollege(college);
                      setSelectedPilotData(pilotData);
                      setIsSummaryModalOpen(true);
                    }}
                    leftIcon={<Download className="w-3.5 h-3.5 text-slate-700" />}
                  >
                    Summary
                  </Button>
                </div>
              </div>

              {/* Factual Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-indigo-600" />
                    Students
                  </span>
                  <p className="text-base font-bold text-slate-900">{pilotData.metrics.registeredStudents}</p>
                  <p className="text-[10px] text-slate-500">Target: {pilotData.goals.targetStudents}</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3 text-rose-600" />
                    Lost Reports
                  </span>
                  <p className="text-base font-bold text-slate-900">{pilotData.metrics.lostReports}</p>
                  <p className="text-[10px] text-slate-500">Pending: {pilotData.metrics.pendingReports}</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3 text-sky-600" />
                    Found Reports
                  </span>
                  <p className="text-base font-bold text-slate-900">{pilotData.metrics.foundReports}</p>
                  <p className="text-[10px] text-slate-500">Total Reports: {pilotData.metrics.lostReports + pilotData.metrics.foundReports}</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-amber-600" />
                    Claims Submitted
                  </span>
                  <p className="text-base font-bold text-slate-900">{pilotData.metrics.claims}</p>
                  <p className="text-[10px] text-slate-500">Verified: {pilotData.metrics.verifiedClaims}</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <PackageCheck className="w-3 h-3 text-emerald-600" />
                    Returned Items
                  </span>
                  <p className="text-base font-bold text-slate-900">{pilotData.metrics.returnedItems}</p>
                  <p className="text-[10px] text-slate-500">Closed Cases: {pilotData.metrics.closedCases}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Goals Modal */}
      {selectedCollege && (
        <Modal
          isOpen={isGoalsModalOpen}
          onClose={() => setIsGoalsModalOpen(false)}
          title={`Operational Pilot Goals — ${selectedCollege.name}`}
          description="Define targets and benchmark dates for operational reference."
        >
          <div className="space-y-4 text-xs">
            <Input
              label="Target Student Registrations"
              type="number"
              value={goalsForm.targetStudents}
              onChange={(e) => setGoalsForm({ ...goalsForm, targetStudents: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Target Total Reports (Lost/Found)"
              type="number"
              value={goalsForm.targetReports}
              onChange={(e) => setGoalsForm({ ...goalsForm, targetReports: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Target Returned Items"
              type="number"
              value={goalsForm.targetReturns}
              onChange={(e) => setGoalsForm({ ...goalsForm, targetReturns: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Target Pilot End Date"
              type="date"
              value={goalsForm.endDate}
              onChange={(e) => setGoalsForm({ ...goalsForm, endDate: e.target.value })}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setIsGoalsModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveGoals} isLoading={isSaving}>
                Save Goals
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Issues Tracking Modal */}
      {selectedCollege && selectedPilotData && (
        <Modal
          isOpen={isIssuesModalOpen}
          onClose={() => setIsIssuesModalOpen(false)}
          title={`Pilot Issue Logging — ${selectedCollege.name}`}
          description="Log and monitor operational issues, bugs, or campus support bottlenecks."
        >
          <div className="space-y-5 text-xs max-h-[70vh] overflow-y-auto pr-1">
            {/* Record New Issue */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Log New Issue</span>
              </h3>
              <Input
                label="Issue Title"
                placeholder="e.g. Storage room access delayed during weekend hours"
                value={issueForm.title}
                onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
              />
              <Textarea
                label="Detailed Description"
                placeholder="Describe operational impact or technical obstacle..."
                rows={2}
                value={issueForm.description}
                onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Severity</label>
                  <select
                    value={issueForm.severity}
                    onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={issueForm.status}
                    onChange={(e) => setIssueForm({ ...issueForm, status: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </div>
              </div>
              <Button size="sm" variant="primary" onClick={handleCreateIssue} isLoading={isSaving}>
                Log Issue
              </Button>
            </div>

            {/* Existing Issues Stream */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Logged Issues Stream</h3>
              {selectedPilotData.issues.length === 0 ? (
                <p className="text-slate-400 py-3 text-center">No issues recorded for this pilot college.</p>
              ) : (
                selectedPilotData.issues.map((iss) => (
                  <div key={iss.id} className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900">{iss.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] ${
                        iss.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                        iss.severity === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {iss.severity} — {iss.status}
                      </span>
                    </div>
                    {iss.description && <p className="text-slate-600 text-[11px]">{iss.description}</p>}
                    <p className="text-[10px] text-slate-400">Logged {new Date(iss.createdAt).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Pilot Feedback Modal */}
      {selectedCollege && (
        <Modal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          title={`Private Pilot Feedback — ${selectedCollege.name}`}
          description="Submitted feedback entries from students and College Admins."
        >
          <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
            {feedbackList.length === 0 ? (
              <p className="py-8 text-center text-slate-500">No feedback entries submitted yet for this pilot.</p>
            ) : (
              feedbackList.map((fb) => (
                <div key={fb.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {fb.userEmail} ({fb.role})
                    </span>
                    <span className="text-amber-600 font-bold">★ {fb.rating} / 5</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{fb.feedback}</p>
                  <p className="text-[10px] text-slate-400">{new Date(fb.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Summary Modal */}
      {selectedCollege && selectedPilotData && (
        <Modal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          title={`Pilot Summary Export — ${selectedCollege.name}`}
          description="Factual overview snapshot for operational reports."
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
              <p><strong>COLLEGE:</strong> {selectedCollege.name} ({selectedCollege.code})</p>
              <p><strong>PILOT STATE:</strong> {selectedPilotData.pilotState}</p>
              <p><strong>STARTED:</strong> {selectedPilotData.startedAt ? new Date(selectedPilotData.startedAt).toLocaleString() : 'N/A'}</p>
              <p><strong>STUDENTS REGISTERED:</strong> {selectedPilotData.metrics.registeredStudents}</p>
              <p><strong>TOTAL REPORTS:</strong> {selectedPilotData.metrics.lostReports + selectedPilotData.metrics.foundReports}</p>
              <p><strong>TOTAL CLAIMS:</strong> {selectedPilotData.metrics.claims}</p>
              <p><strong>VERIFIED CLAIMS:</strong> {selectedPilotData.metrics.verifiedClaims}</p>
              <p><strong>RETURNED ITEMS:</strong> {selectedPilotData.metrics.returnedItems}</p>
              <p><strong>FEEDBACK ENTRIES:</strong> {selectedPilotData.feedbackCount}</p>
              <p><strong>LOGGED ISSUES:</strong> {selectedPilotData.issues.length}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsSummaryModalOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const summaryText = JSON.stringify(selectedPilotData, null, 2);
                  const blob = new Blob([summaryText], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `foundly_pilot_summary_${selectedCollege.code}.json`;
                  a.click();
                  showToast({ type: 'success', title: 'Export Downloaded', message: 'Pilot JSON report generated.' });
                }}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download JSON Report
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
