import React from 'react';
import { Users, Search, Mail, Building2, Inbox } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { Profile } from '../../types';

export const AdminStudentsPage: React.FC = () => {
  // Strict constraint: No fake data.
  // In Phase 2:
  // supabase.from('profiles').select('*').eq('college_id', adminCollegeId).eq('role', 'STUDENT')
  const students: Profile[] = [];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registered Campus Students</h1>
          <p className="text-xs text-slate-500 mt-1">
            Directory of verified students affiliated with University Campus Alpha
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        {students.length === 0 ? (
          <EmptyState
            title="No students registered yet"
            description="As students at your college create accounts during signup, their directory records will appear here under your administration."
            icon={<Users className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            {/* Real directory rendered here in Phase 2 */}
          </div>
        )}
      </div>
    </div>
  );
};
