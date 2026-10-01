import React, { useState, useEffect } from 'react';
import { Users, Building2, Mail, ShieldCheck, ShieldAlert, Ban, CheckCircle2, User, Phone, ShieldX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const OwnerAdminsPage: React.FC = () => {
  const { showToast } = useToast();
  const { session } = useAuth();

  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadAdmins = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*, colleges(*)')
        .eq('role', 'college_admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err: any) {
      console.error('Error loading admins:', err);
      showToast({
        type: 'error',
        title: 'Query Failed',
        message: 'Could not load active campus administrators.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleSuspend = async (adminId: string, name: string) => {
    if (isActionLoading) return;
    try {
      setIsActionLoading(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/suspend-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to suspend administrator.');

      showToast({
        type: 'success',
        title: 'Admin Suspended 🚫',
        message: `${name} has been suspended from administrative tasks.`,
      });

      // Reload list to update status
      await loadAdmins();
    } catch (err: any) {
      console.error('Suspension error:', err);
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not suspend this administrator.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReactivate = async (adminId: string, name: string) => {
    if (isActionLoading) return;
    try {
      setIsActionLoading(true);
      const token = session?.access_token;

      const res = await fetch('/api/owner/reactivate-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate administrator.');

      showToast({
        type: 'success',
        title: 'Admin Reactivated 🎉',
        message: `${name}'s administrative access has been restored.`,
      });

      // Reload list
      await loadAdmins();
    } catch (err: any) {
      console.error('Reactivation error:', err);
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not restore administrator access.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Retrieving administrative operators..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in" id="owner-admins-root">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Approved College Admins</h1>
        <p className="text-xs text-slate-500 mt-1">
          Active campus representatives authorized to operate lost and found operations
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        {admins.length === 0 ? (
          <EmptyState
            title="No approved admins yet"
            description="Once you verify and approve administrator applications from the Admin Requests queue, authorized campus operators will be listed here."
            icon={<Users className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold bg-slate-50/50">
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Affiliated Campus</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {admins.map((adm) => {
                  const isSuspended = Boolean(adm.avatar_url?.startsWith('[SUSPENDED]'));
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl shrink-0 ${isSuspended ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-950">{adm.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono font-medium">{adm.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{adm.colleges?.name || 'Unknown'}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-bold">
                            {adm.colleges?.code}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 space-y-0.5">
                        <p className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{adm.email || '—'}</span>
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Suspended</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active Operator</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isSuspended ? (
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={isActionLoading}
                            onClick={() => handleReactivate(adm.id, adm.full_name)}
                            leftIcon={<CheckCircle2 className="w-3 h-3" />}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isActionLoading}
                            onClick={() => handleSuspend(adm.id, adm.full_name)}
                            leftIcon={<Ban className="w-3 h-3 text-rose-600" />}
                          >
                            Suspend Admin
                          </Button>
                        )}
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
