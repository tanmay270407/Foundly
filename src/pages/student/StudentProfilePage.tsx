import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { 
  User, 
  Mail, 
  Building2, 
  ShieldCheck, 
  Save, 
  Phone,
  GraduationCap
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const StudentProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    } else if (user) {
      setFullName(user.user_metadata?.full_name || '');
    }
  }, [profile, user]);

  // Look up college name from Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadCollegeName() {
      if (profile?.college_id && isSupabaseConfigured()) {
        const { data } = await supabase
          .from('colleges')
          .select('name, code')
          .eq('id', profile.college_id)
          .maybeSingle();

        if (isMounted && data) {
          setCollegeName(`${data.name} (${data.code})`);
        }
      }
    }
    loadCollegeName();
    return () => {
      isMounted = false;
    };
  }, [profile?.college_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);

    if (isSupabaseConfigured()) {
      try {
        // Enforce: only full_name and phone are updated
        // Role and college_id are strictly immutable by students
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            phone: phone.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        setIsSaving(false);

        if (error) {
          showToast({
            type: 'error',
            title: 'Update Failed',
            message: getFriendlyAuthErrorMessage(error),
          });
          return;
        }

        await refreshProfile();
        showToast({
          type: 'success',
          title: 'Profile Updated',
          message: 'Personal details updated successfully.',
        });
      } catch (err: any) {
        setIsSaving(false);
        showToast({
          type: 'error',
          title: 'Error',
          message: getFriendlyAuthErrorMessage(err),
        });
      }
    } else {
      setIsSaving(false);
      showToast({
        type: 'info',
        title: 'Demo Environment',
        message: 'Personal details updated locally. Configure Supabase credentials for cloud persistence.',
      });
    }
  };

  const displayEmail = profile?.email || user?.email || 'student@campus.edu';
  const displayRole = (profile?.role || 'student').toUpperCase();
  const displayCollege = collegeName || profile?.college_id || 'Affiliated Campus';

  const initials = (fullName || 'Student')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Profile</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your contact preferences and view verified campus credentials
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        {/* Profile Avatar Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
          <div className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-2xl border-2 border-white shadow-xs">
            {initials}
          </div>

          <div className="text-center sm:text-left">
            <h3 className="text-lg font-bold text-slate-900">{fullName || 'Student Account'}</h3>
            <p className="text-xs text-slate-500">{displayEmail}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200/60">
                <GraduationCap className="w-3 h-3" />
                <span>Role: {displayRole}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>{displayCollege}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Contact Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              leftIcon={<Phone className="w-4 h-4" />}
              helperText="For campus lost & found handover notifications"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Verified Campus Email (Auth Bound)"
              value={displayEmail}
              disabled
              leftIcon={<Mail className="w-4 h-4" />}
              helperText="Managed by your university authentication"
            />

            <Input
              label="Affiliated Campus (Locked by College Admin)"
              value={displayCollege}
              disabled
              leftIcon={<Building2 className="w-4 h-4" />}
              helperText="Ensures campus-exclusive data partition"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Role Security:</strong> Students cannot self-promote to an administrator. College Admin access requires application submission and Foundly Owner verification.
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
