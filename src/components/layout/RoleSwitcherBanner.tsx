import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { Compass, GraduationCap, Building2, ShieldCheck, Database, UserCheck } from 'lucide-react';

export const RoleSwitcherBanner: React.FC = () => {
  const { currentPath, navigate, perspective, setPerspective } = useRouter();
  const { user, profile, role, isConfigured } = useAuth();

  return (
    <div className="bg-slate-900 text-slate-200 text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          FOUNDLY PHASE 2 (SUPABASE)
        </span>
        <span className="text-slate-400 hidden sm:inline">|</span>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono">
          <Database className="w-3 h-3 text-indigo-400" />
          <span>{isConfigured ? 'Connected' : 'Credentials Ready'}</span>
        </div>
        {user && (
          <>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-300 font-mono">
              <UserCheck className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{user.email}</span>
              <span className="px-1 py-0.2 bg-emerald-900/50 rounded text-[10px] text-emerald-200">
                {role?.toUpperCase()}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
        <span className="text-[11px] text-slate-400 hidden md:inline mr-1">Preview Route:</span>
        <button
          onClick={() => {
            setPerspective('PUBLIC');
            navigate('/');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
            perspective === 'PUBLIC'
              ? 'bg-white text-slate-900 font-semibold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Public</span>
        </button>

        <button
          onClick={() => {
            setPerspective('STUDENT');
            navigate('/student');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
            perspective === 'STUDENT'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Student</span>
        </button>

        <button
          onClick={() => {
            setPerspective('COLLEGE_ADMIN');
            navigate('/admin');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
            perspective === 'COLLEGE_ADMIN'
              ? 'bg-amber-600 text-white font-semibold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>College Admin</span>
        </button>

        <button
          onClick={() => {
            setPerspective('FOUNDLY_OWNER');
            navigate('/owner');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
            perspective === 'FOUNDLY_OWNER'
              ? 'bg-purple-600 text-white font-semibold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Owner</span>
        </button>
      </div>
    </div>
  );
};
