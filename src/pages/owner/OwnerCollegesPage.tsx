import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Globe, 
  MapPin, 
  CheckCircle2, 
  Ban, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  ShieldAlert, 
  FileText, 
  ClipboardList, 
  PackageCheck,
  ShieldCheck,
  PlusCircle,
  Rocket
} from 'lucide-react';
import { CollegeLaunchKitModal } from '../../components/owner/CollegeLaunchKitModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const OwnerCollegesPage: React.FC = () => {
  const { showToast } = useToast();
  const { session } = useAuth();

  const [colleges, setColleges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedCollegeId, setExpandedCollegeId] = useState<string | null>(null);

  // College Launch Kit state
  const [selectedCollegeForLaunchKit, setSelectedCollegeForLaunchKit] = useState<any | null>(null);
  const [isLaunchKitModalOpen, setIsLaunchKitModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [domain, setDomain] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const loadColleges = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Query real database counters for each college in parallel
      const collegesWithStats = await Promise.all((data || []).map(async (col) => {
        // Students count
        const { count: studentCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', col.id)
          .eq('role', 'student');

        // Admins count and details
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('college_id', col.id)
          .eq('role', 'college_admin');

        const adminCount = adminProfiles?.length || 0;

        // Lost items count
        const { count: lostCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', col.id)
          .eq('type', 'lost');

        // Found items count
        const { count: foundCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', col.id)
          .eq('type', 'found');

        // Active claims count
        const { count: activeClaimsCount } = await supabase
          .from('claims')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', col.id)
          .in('status', ['pending', 'under_review']);

        // Returned items count
        const { count: returnedCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', col.id)
          .eq('status', 'returned');

        return {
          ...col,
          stats: {
            students: studentCount || 0,
            admins: adminCount || 0,
            adminList: adminProfiles || [],
            lostItems: lostCount || 0,
            foundItems: foundCount || 0,
            activeClaims: activeClaimsCount || 0,
            returnedItems: returnedCount || 0
          }
        };
      }));

      setColleges(collegesWithStats);
    } catch (err: any) {
      console.error('Error loading colleges with stats:', err);
      showToast({
        type: 'error',
        title: 'Query Failed',
        message: 'Could not load registered colleges or metrics.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadColleges();
  }, []);

  const handleAddCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || isActionLoading) {
      showToast({ type: 'error', title: 'Input Required', message: 'College name and campus code are required.' });
      return;
    }

    try {
      setIsActionLoading(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/create-college', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          domain: domain.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register college.');

      showToast({
        type: 'success',
        title: 'College Onboarded 🎉',
        message: `"${name}" has been successfully added to platform directories.`,
      });

      setIsAddModalOpen(false);
      setName('');
      setCode('');
      setDomain('');
      setCity('');
      setState('');

      await loadColleges();
    } catch (err: any) {
      console.error('Create college error:', err);
      showToast({
        type: 'error',
        title: 'Onboarding Failed',
        message: err.message || 'Could not register new college.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleActivation = async (collegeId: string, currentDomain: string, name: string) => {
    if (isActionLoading) return;
    const isDeactivating = !currentDomain?.startsWith('[DEACTIVATED]');
    
    try {
      setIsActionLoading(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/toggle-college', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ collegeId, isDeactivating })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update college status.');

      showToast({
        type: isDeactivating ? 'info' : 'success',
        title: isDeactivating ? 'College Deactivated 🚫' : 'College Activated 🎉',
        message: `"${name}" directory has been ${isDeactivating ? 'deactivated' : 'reactivated successfully'}.`,
      });

      await loadColleges();
    } catch (err: any) {
      console.error('Toggle college status error:', err);
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not update college activation state.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCollegeId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Retrieving college directory partitions & statistics..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in" id="owner-colleges-root">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage College Campuses</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered university directories that partition student data and administrator permissions
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add New College
        </Button>
      </div>

      {/* Colleges Table */}
      <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        {colleges.length === 0 ? (
          <EmptyState
            title="No onboarding colleges"
            description="Register a new college to partition lost & found activities."
            icon={<Building2 className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold bg-slate-50/50">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Campus Name</th>
                  <th className="py-3 px-4">Campus Code</th>
                  <th className="py-3 px-4">Authorized Domain</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {colleges.map((col) => {
                  const isDeactivated = Boolean(col.domain?.startsWith('[DEACTIVATED]'));
                  const cleanDomain = col.domain?.replace('[DEACTIVATED]', '') || '';
                  const isExpanded = expandedCollegeId === col.id;

                  return (
                    <React.Fragment key={col.id}>
                      <tr 
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(col.id)}
                      >
                        <td className="py-3.5 px-4 text-center">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Building2 className={`w-4 h-4 shrink-0 ${isDeactivated ? 'text-slate-400' : 'text-indigo-600'}`} />
                            <span>{col.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {col.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {cleanDomain ? (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                              <span>@{cleanDomain}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {col.city && col.state ? `${col.city}, ${col.state}` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {isDeactivated ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <Ban className="w-3 h-3" />
                              <span>Deactivated</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCollegeForLaunchKit(col);
                                setIsLaunchKitModalOpen(true);
                              }}
                              leftIcon={<Rocket className="w-3.5 h-3.5 text-indigo-600" />}
                            >
                              Launch Kit
                            </Button>

                            {isDeactivated ? (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={isActionLoading}
                                onClick={() => handleToggleActivation(col.id, col.domain, col.name)}
                                leftIcon={<CheckCircle2 className="w-3 h-3" />}
                              >
                                Activate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActionLoading}
                                onClick={() => handleToggleActivation(col.id, col.domain, col.name)}
                                leftIcon={<Ban className="w-3 h-3 text-rose-600" />}
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Statistics & Operational Health row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/80 p-6 border-y border-slate-200/80">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Directory Operational Health & Real-time Metrics ({col.code})</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {col.stats?.admins > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                      <span>Admin Assigned ({col.stats.admins})</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                                      <span>No Admin Assigned</span>
                                    </span>
                                  )}

                                  {isDeactivated ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                                      <Ban className="w-3 h-3 text-rose-600" />
                                      <span>Directory Suspended</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                                      <CheckCircle2 className="w-3 h-3 text-sky-600" />
                                      <span>Active Scope</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Students</span>
                                  </div>
                                  <p className="text-lg font-bold text-slate-900">{col.stats?.students ?? 0}</p>
                                </div>

                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Admins</span>
                                  </div>
                                  <p className="text-lg font-bold text-slate-900">{col.stats?.admins ?? 0}</p>
                                </div>

                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Lost Items</span>
                                  </div>
                                  <p className="text-lg font-bold text-slate-900">{col.stats?.lostItems ?? 0}</p>
                                </div>

                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <ClipboardList className="w-3.5 h-3.5 text-sky-500" />
                                    <span>Found Items</span>
                                  </div>
                                  <p className="text-lg font-bold text-slate-900">{col.stats?.foundItems ?? 0}</p>
                                </div>

                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Active Claims</span>
                                  </div>
                                  <p className="text-lg font-bold text-slate-900">{col.stats?.activeClaims ?? 0}</p>
                                </div>

                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Returned Items</span>
                                  </div>
                                  <p className="text-lg font-bold text-slate-900">{col.stats?.returnedItems ?? 0}</p>
                                </div>
                              </div>

                              {/* Assigned Administrators Detail List */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-200/60 space-y-2">
                                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Assigned Campus Administrators</span>
                                </p>
                                {col.stats?.adminList && col.stats.adminList.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {col.stats.adminList.map((adm: any) => (
                                      <div key={adm.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                        <div>
                                          <p className="text-xs font-semibold text-slate-900">{adm.full_name}</p>
                                          <p className="text-[10px] text-slate-500">{adm.email}</p>
                                        </div>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Verified Admin</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No College Administrator currently assigned to this campus. Representative application required.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add College Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Onboard New College Campus"
        description="Creates a new independent college partition in the directory database."
      >
        <form onSubmit={handleAddCollegeSubmit} className="space-y-4">
          <Input
            label="College Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Stanford University"
            requiredIndicator
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Campus Short Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. STAN"
              requiredIndicator
            />

            <Input
              label="Email Domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. stanford.edu"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Stanford"
            />

            <Input
              label="State / Province"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. CA"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" disabled={isActionLoading} onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isActionLoading}>
              Save College
            </Button>
          </div>
        </form>
      </Modal>

      {/* College Launch Kit & Onboarding Modal */}
      {selectedCollegeForLaunchKit && (
        <CollegeLaunchKitModal
          isOpen={isLaunchKitModalOpen}
          onClose={() => setIsLaunchKitModalOpen(false)}
          college={selectedCollegeForLaunchKit}
          onRefresh={loadColleges}
        />
      )}
    </div>
  );
};
