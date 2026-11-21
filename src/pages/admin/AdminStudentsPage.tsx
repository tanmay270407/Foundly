import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { Profile } from '../../types';

interface MemberRow extends Profile {
  reportsCount: number;
  claimsCount: number;
}

export const AdminStudentsPage: React.FC = () => {
  const { user, profile, session, configuredCollege } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'student' | 'college_admin'>('ALL');

  const [targetMember, setTargetMember] = useState<MemberRow | null>(null);
  const [targetNewRole, setTargetNewRole] = useState<'student' | 'college_admin'>('college_admin');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const targetCollegeId = profile?.college_id || configuredCollege?.id;

  const fetchMembers = async () => {
    if (!isSupabaseConfigured() || !targetCollegeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ data: profilesData, error: profErr }, { data: itemsData }, { data: claimsData }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('college_id', targetCollegeId)
            .in('role', ['student', 'college_admin'])
            .order('created_at', { ascending: false }),
          supabase.from('items').select('user_id').eq('college_id', targetCollegeId),
          supabase.from('claims').select('claimant_id').eq('college_id', targetCollegeId),
        ]);

      if (profErr) {
        showToast({
          type: 'error',
          title: 'Directory Load Failed',
          message: profErr.message,
        });
        return;
      }

      const reportCounts = new Map<string, number>();
      (itemsData || []).forEach((i: any) => {
        reportCounts.set(i.user_id, (reportCounts.get(i.user_id) || 0) + 1);
      });

      const claimCounts = new Map<string, number>();
      (claimsData || []).forEach((c: any) => {
        claimCounts.set(c.claimant_id, (claimCounts.get(c.claimant_id) || 0) + 1);
      });

      const mapped: MemberRow[] = (profilesData || []).map((p: any) => ({
        ...p,
        reportsCount: reportCounts.get(p.id) || 0,
        claimsCount: claimCounts.get(p.id) || 0,
      }));

      setMembers(mapped);
    } catch (err: any) {
      console.error('Error loading campus directory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [targetCollegeId]);

  const handleConfirmRoleChange = async () => {
    if (!targetMember || !session?.access_token) return;

    setIsUpdatingRole(true);
    try {
      const res = await fetch('/api/admin/assign-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: targetMember.id,
          newRole: targetNewRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not update role.');
      }

      showToast({
        type: 'success',
        title: 'Role Updated',
        message: data.message || 'Member role updated.',
      });

      setTargetMember(null);
      fetchMembers();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Role Change Failed',
        message: err.message,
      });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const normRole = (m.role || 'student').toLowerCase();
    if (roleFilter !== 'ALL' && normRole !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const studentCount = members.filter((m) => (m.role || '').toLowerCase() === 'student').length;
  const adminCount = members.filter((m) => (m.role || '').toLowerCase() === 'college_admin').length;

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Students</h1>
        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
          <span>
            <strong className="font-semibold text-slate-900">{studentCount}</strong> students
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="font-semibold text-slate-900">{adminCount}</strong> admins
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2.5">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            options={[
              { value: 'ALL', label: 'All Roles' },
              { value: 'student', label: 'Students' },
              { value: 'college_admin', label: 'Admins' },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading directory..." />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            title="No matching members"
            icon={<Users className="w-6 h-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Reports</th>
                  <th className="py-2.5 px-4">Claims</th>
                  <th className="py-2.5 px-4">Joined</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMembers.map((member) => {
                  const isAdminRow = (member.role || '').toLowerCase() === 'college_admin';
                  const isSelf = member.id === user?.id;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          <span>{member.full_name || 'Unnamed'}</span>
                          {isSelf && (
                            <span className="text-[11px] text-slate-400">(You)</span>
                          )}
                        </div>
                        <div className="text-slate-500 mt-0.5">{member.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        {isAdminRow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium text-[11px]">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            <GraduationCap className="w-3 h-3" />
                            Student
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 tabular-nums">{member.reportsCount}</td>
                      <td className="py-3 px-4 tabular-nums">{member.claimsCount}</td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isSelf ? (
                          <span className="text-slate-400">—</span>
                        ) : isAdminRow ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTargetMember(member);
                              setTargetNewRole('student');
                            }}
                            leftIcon={<UserCog className="w-3.5 h-3.5 text-rose-500" />}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTargetMember(member);
                              setTargetNewRole('college_admin');
                            }}
                            leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />}
                          >
                            Make Admin
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

      <ConfirmationDialog
        isOpen={Boolean(targetMember)}
        onClose={() => setTargetMember(null)}
        onConfirm={handleConfirmRoleChange}
        title={
          targetNewRole === 'college_admin'
            ? 'Assign College Admin Role?'
            : 'Revoke College Admin Access?'
        }
        message={
          targetNewRole === 'college_admin'
            ? `Promote "${targetMember?.full_name || targetMember?.email}" to College Admin with full campus moderation and verification permissions?`
            : `Demote "${targetMember?.full_name || targetMember?.email}" to Student? They will lose access to the Admin Portal immediately.`
        }
        confirmLabel={targetNewRole === 'college_admin' ? 'Make Admin' : 'Revoke Access'}
        isDangerous={targetNewRole !== 'college_admin'}
        isLoading={isUpdatingRole}
      />
    </div>
  );
};
