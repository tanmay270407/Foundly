import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter, 
  Activity, 
  Ban, 
  CheckSquare,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getCollegeLaunchData, CollegeLaunchData, LaunchStatus } from '../../lib/collegeLaunch';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CollegeLaunchKitModal } from '../../components/owner/CollegeLaunchKitModal';

interface CollegeRolloutItem {
  college: any;
  launchData: CollegeLaunchData;
}

export const OwnerRolloutPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [rolloutItems, setRolloutItems] = useState<CollegeRolloutItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [selectedCollegeForKit, setSelectedCollegeForKit] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadRolloutData = async () => {
    if (!isSupabaseConfigured()) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const { data: colleges, error } = await supabase
        .from('colleges')
        .select('*')
        .order('name');

      if (error) throw error;

      if (colleges) {
        const itemsWithData: CollegeRolloutItem[] = await Promise.all(
          colleges.map(async (col) => {
            const launchData = await getCollegeLaunchData(col.id);
            return { college: col, launchData };
          })
        );
        setRolloutItems(itemsWithData);
      }
    } catch (err: any) {
      console.error('Error loading rollout data:', err);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load college rollout data.',
      });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadRolloutData();
  }, []);

  const filteredItems = rolloutItems.filter(({ college, launchData }) => {
    const matchesSearch = 
      college.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      college.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || launchData.launchStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in" id="owner-rollout-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
            <Rocket className="w-4 h-4" />
            <span>Platform Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            College Rollout & Launch Readiness Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Controlled, repeatable rollout management and readiness checklists across all campus directories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadRolloutData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/owner/colleges')}
            leftIcon={<Building2 className="w-3.5 h-3.5" />}
          >
            Manage Colleges
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search college by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'SETUP', 'READY_FOR_LAUNCH', 'ACTIVE', 'PAUSED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Rollout Table */}
      {isFetching ? (
        <div className="py-20 text-center text-xs text-slate-500">Loading rollout metrics across directories...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
          No college directories match the selected search or launch state filter.
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">College Directory</th>
                  <th className="py-3.5 px-4">Launch State</th>
                  <th className="py-3.5 px-4">Assigned Admin</th>
                  <th className="py-3.5 px-4">Checklist Progress</th>
                  <th className="py-3.5 px-4">Critical Issues</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(({ college, launchData }) => {
                  const completedCount = launchData.checklist.filter((i) => i.completed).length;
                  const totalCount = launchData.checklist.length;
                  const percent = Math.round((completedCount / (totalCount || 1)) * 100);
                  const hasCriticalIssues = launchData.incompleteCriticalChecks.length > 0;

                  return (
                    <tr key={college.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{college.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">Code: {college.code}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          launchData.launchStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : launchData.launchStatus === 'READY_FOR_LAUNCH'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : launchData.launchStatus === 'PAUSED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            launchData.launchStatus === 'ACTIVE' ? 'bg-emerald-500' :
                            launchData.launchStatus === 'READY_FOR_LAUNCH' ? 'bg-indigo-500' :
                            launchData.launchStatus === 'PAUSED' ? 'bg-rose-500' : 'bg-slate-400'
                          }`} />
                          {launchData.launchStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {launchData.adminReadiness.hasApprovedAdmin ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{launchData.adminReadiness.adminEmail || 'Assigned'}</span>
                          </div>
                        ) : (
                          <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded text-[10px]">
                            Pending Admin
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between font-semibold text-[10px] text-slate-600">
                            <span>{percent}%</span>
                            <span>{completedCount}/{totalCount}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div 
                              className={`h-full ${percent === 100 ? 'bg-emerald-600' : 'bg-indigo-600'}`} 
                              style={{ width: `${percent}%` }} 
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {hasCriticalIssues ? (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-semibold" title={launchData.incompleteCriticalChecks.join(', ')}>
                            <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>{launchData.incompleteCriticalChecks.length} Incomplete</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Ready</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCollegeForKit(college);
                            setIsModalOpen(true);
                          }}
                          leftIcon={<Rocket className="w-3.5 h-3.5 text-indigo-600" />}
                        >
                          Readiness Kit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* College Launch Kit Modal */}
      {selectedCollegeForKit && (
        <CollegeLaunchKitModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          college={selectedCollegeForKit}
          onRefresh={loadRolloutData}
        />
      )}
    </div>
  );
};
