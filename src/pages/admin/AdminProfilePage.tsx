import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { Building2, ShieldCheck, Mail, Phone, BadgeCheck, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const AdminProfilePage: React.FC = () => {
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

  useEffect(() => {
    let isMounted = true;
    async function loadCollege() {
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
    loadCollege();
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
          title: 'Admin Profile Updated',
          message: 'Contact details updated successfully.',
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
        message: 'Admin profile updated.',
      });
    }
  };

  const displayEmail = profile?.email || user?.email || 'admin@campus.edu';
  const displayCollege = collegeName || profile?.college_id || 'Campus Administrative Domain';

  const initials = (fullName || 'Admin')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">College Admin Profile</h1>
        <p className="text-xs text-slate-500 mt-1">
          Authorized campus administrator credentials and departmental office information
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl">
            {initials}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{fullName || 'Campus Administrator'}</h3>
            <p className="text-xs text-slate-500">{displayEmail}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Verified College Admin</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>{displayCollege}</span>
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Staff Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Input
              label="Office Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Official Staff Email (Auth Locked)"
              value={displayEmail}
              disabled
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Administered College (Locked)"
              value={displayCollege}
              disabled
              leftIcon={<Building2 className="w-4 h-4" />}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
              Save Admin Settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
