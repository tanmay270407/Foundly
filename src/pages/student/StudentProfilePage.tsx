import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage, safeUpdate } from '../../lib/supabase';
import { User, Mail, Building2, Save, Phone } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const StudentProfilePage: React.FC = () => {
  const { user, profile, configuredCollege, refreshProfile } = useAuth();
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
    async function loadCollegeName() {
      if (configuredCollege?.name) {
        setCollegeName(
          `${configuredCollege.name}${configuredCollege.code ? ` (${configuredCollege.code})` : ''}`
        );
        return;
      }
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
  }, [profile?.college_id, configuredCollege?.name, configuredCollege?.code]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);

    if (isSupabaseConfigured()) {
      try {
        const { error } = await safeUpdate('profiles', 'id', user.id, {
          full_name: fullName.trim(),
          phone: phone.trim(),
          updated_at: new Date().toISOString(),
        });

        setIsSaving(false);

        if (error) {
          showToast({
            type: 'error',
            title: 'Update failed',
            message: getFriendlyAuthErrorMessage(error),
          });
          return;
        }

        await refreshProfile();
        showToast({
          type: 'success',
          title: 'Saved',
          message: 'Profile updated.',
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
    }
  };

  const displayEmail = profile?.email || user?.email || 'student@campus.edu';
  const displayCollege = collegeName || configuredCollege?.name || 'Galgotias University';

  const initials = (fullName || 'S')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Profile</h1>

      <div className="rounded-xl border border-slate-200/80 bg-white p-6 space-y-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-semibold text-base shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {fullName || 'Student'}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {displayEmail} · {displayCollege}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Email"
              value={displayEmail}
              disabled
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Campus"
              value={displayCollege}
              disabled
              leftIcon={<Building2 className="w-4 h-4" />}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
