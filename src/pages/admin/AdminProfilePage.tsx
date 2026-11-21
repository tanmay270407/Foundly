import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage, safeUpdate } from '../../lib/supabase';
import {
  Building2,
  ShieldCheck,
  Mail,
  Phone,
  Save,
  MapPin,
  Clock,
  User,
  Briefcase,
  BadgeCheck,
  Camera,
  Trash2,
  Lock,
  Sparkles,
  DoorOpen,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';

const GALGOTIAS_PRESET = {
  collegeName: 'Galgotias University',
  collegeCode: 'GU',
  city: 'Greater Noida',
  state: 'Uttar Pradesh',
  officeName: 'Galgotias University Lost & Found Office',
  officeLocation:
    'Block A, Ground Floor, Campus Security & Student Welfare Desk, Plot No. 2, Sector 17-A, Yamuna Expressway, Greater Noida',
  officeHours: 'Monday – Saturday, 9:00 AM – 5:00 PM',
  officeEmail: 'lostandfound@galgotiasuniversity.edu.in',
  officePhone: '+91-120-4370000',
  handoverInstructions:
    'Bring your valid Galgotias University Student ID card and claim reference ID to verify ownership before collecting approved items.',
};

export const AdminProfilePage: React.FC = () => {
  const { user, session, profile, configuredCollege, refreshProfile, refreshCollege } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [staffId, setStaffId] = useState('');
  const [officeRoom, setOfficeRoom] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [collegeName, setCollegeName] = useState('');
  const [collegeCode, setCollegeCode] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [officeEmail, setOfficeEmail] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [handoverInstructions, setHandoverInstructions] = useState('');
  const [isSavingOffice, setIsSavingOffice] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    const meta = (user?.user_metadata || {}) as Record<string, any>;
    if (profile) {
      setFullName(profile.full_name || meta.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(
        profile.avatar_url && !profile.avatar_url.startsWith('[SUSPENDED]')
          ? profile.avatar_url
          : ''
      );
    } else if (user) {
      setFullName(meta.full_name || '');
    }

    setDesignation(meta.designation || 'Campus Lost & Found Administrator');
    setDepartment(meta.department || 'Office of Student Welfare & Campus Security');
    setStaffId(meta.staff_id || '');
    setOfficeRoom(meta.office_room || '');
    setBio(meta.bio || '');
  }, [profile, user]);

  useEffect(() => {
    if (configuredCollege) {
      setCollegeName(configuredCollege.name || 'Galgotias University');
      setCollegeCode(configuredCollege.code || 'GU');
      setCity(configuredCollege.city || '');
      setStateName(configuredCollege.state || '');
      setOfficeName(configuredCollege.office_name || '');
      setOfficeLocation(configuredCollege.office_location || '');
      setOfficeHours(configuredCollege.office_hours || '');
      setOfficeEmail(configuredCollege.contact_email || '');
      setOfficePhone(configuredCollege.contact_phone || '');
      setHandoverInstructions(configuredCollege.pickup_instructions || '');
    }
  }, [configuredCollege]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Choose an image smaller than 3MB.',
      });
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast({
        type: 'error',
        title: 'Invalid Type',
        message: 'PNG, JPG, and WEBP images are supported.',
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      showToast({
        type: 'info',
        title: 'Storage Not Connected',
        message: 'Connect Supabase Storage to upload photos.',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/admin-avatar-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      showToast({
        type: 'success',
        title: 'Photo Uploaded',
        message: 'Save profile to apply your new photo.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: err?.message || 'Could not upload avatar.',
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullName.trim()) {
      showToast({
        type: 'error',
        title: 'Name Required',
        message: 'Enter your full name.',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      if (!isSupabaseConfigured()) {
        showToast({
          type: 'info',
          title: 'Supabase Not Configured',
          message: 'Connect Supabase to save changes.',
        });
        return;
      }

      if (session?.access_token) {
        const res = await fetch('/api/admin/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            phone: phone.trim(),
            avatar_url: avatarUrl.trim(),
            designation: designation.trim(),
            department: department.trim(),
            staff_id: staffId.trim(),
            office_room: officeRoom.trim(),
            bio: bio.trim(),
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            payload.details
              ? `${payload.error || 'Could not update profile.'} (${payload.details})`
              : payload.error || 'Could not update profile.'
          );
        }
      } else {
        const { error } = await safeUpdate('profiles', 'id', user.id, {
          full_name: fullName.trim(),
          phone: phone.trim(),
          avatar_url: avatarUrl.trim() || null,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          designation: designation.trim(),
          department: department.trim(),
          staff_id: staffId.trim(),
          office_room: officeRoom.trim(),
          bio: bio.trim(),
        },
      });

      await refreshProfile();
      showToast({
        type: 'success',
        title: 'Profile Saved',
        message: 'Administrator profile updated.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: getFriendlyAuthErrorMessage(err),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleApplyGalgotiasPreset = () => {
    setCollegeName(GALGOTIAS_PRESET.collegeName);
    setCollegeCode(GALGOTIAS_PRESET.collegeCode);
    setCity(GALGOTIAS_PRESET.city);
    setStateName(GALGOTIAS_PRESET.state);
    setOfficeName(GALGOTIAS_PRESET.officeName);
    setOfficeLocation(GALGOTIAS_PRESET.officeLocation);
    setOfficeHours(GALGOTIAS_PRESET.officeHours);
    setOfficeEmail(GALGOTIAS_PRESET.officeEmail);
    setOfficePhone(GALGOTIAS_PRESET.officePhone);
    setHandoverInstructions(GALGOTIAS_PRESET.handoverInstructions);
    showToast({
      type: 'info',
      title: 'Preset Loaded',
      message: 'Review fields and click Save Settings.',
    });
  };

  const handleSaveOfficeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) {
      showToast({
        type: 'error',
        title: 'Session Expired',
        message: 'Please sign in again.',
      });
      return;
    }

    if (!collegeName.trim()) {
      showToast({
        type: 'error',
        title: 'University Name Required',
        message: 'Enter your university or college name.',
      });
      return;
    }

    setIsSavingOffice(true);
    try {
      const response = await fetch('/api/admin/college-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          college_name: collegeName.trim(),
          college_code: collegeCode.trim().toUpperCase(),
          city: city.trim(),
          state: stateName.trim(),
          office_name: officeName.trim(),
          office_location: officeLocation.trim(),
          office_hours: officeHours.trim(),
          contact_email: officeEmail.trim(),
          contact_phone: officePhone.trim(),
          pickup_instructions: handoverInstructions.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.details
            ? `${data.error || 'Could not save settings.'} (${data.details})`
            : data.error || 'Could not save settings.'
        );
      }

      await refreshCollege();
      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: `${collegeName.trim()} settings updated.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update university settings.',
      });
    } finally {
      setIsSavingOffice(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      showToast({
        type: 'info',
        title: 'Supabase Not Configured',
        message: 'Connect Supabase Auth to update password.',
      });
      return;
    }

    if (newPassword.length < 6) {
      showToast({
        type: 'error',
        title: 'Weak Password',
        message: 'Minimum 6 characters required.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({
        type: 'error',
        title: 'Passwords Do Not Match',
        message: 'Both password fields must match.',
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      showToast({
        type: 'success',
        title: 'Password Updated',
        message: 'Your password has been updated.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: getFriendlyAuthErrorMessage(err),
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const displayEmail = profile?.email || user?.email || 'Admin27@gmail.com';
  const displayCollege = collegeName
    ? `${collegeName}${collegeCode ? ` (${collegeCode})` : ''}`
    : configuredCollege
    ? `${configuredCollege.name}${configuredCollege.code ? ` (${configuredCollege.code})` : ''}`
    : 'Galgotias University (GU)';

  const initials = (fullName || 'Admin')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-3xl space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-slate-900 tracking-tight">Settings</h1>

      {/* Admin Profile */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Admin'}
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-semibold text-base border border-indigo-100 shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 truncate">
                {fullName || 'College Administrator'}
              </h2>
              <p className="text-xs text-slate-500 truncate mt-0.5">{displayEmail}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{displayCollege}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              isLoading={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Camera className="w-3.5 h-3.5" />}
            >
              {avatarUrl ? 'Change' : 'Upload Photo'}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAvatarUrl('')}
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Rajesh Sharma"
              leftIcon={<User className="w-4 h-4" />}
              requiredIndicator
            />
            <Input
              label="Designation"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Lost & Found Coordinator"
              leftIcon={<Briefcase className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Office of Student Welfare"
              leftIcon={<Building2 className="w-4 h-4" />}
            />
            <Input
              label="Staff ID"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="GU-ADM-001"
              leftIcon={<BadgeCheck className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              leftIcon={<Phone className="w-4 h-4" />}
            />
            <Input
              label="Office Room"
              value={officeRoom}
              onChange={(e) => setOfficeRoom(e.target.value)}
              placeholder="Block A, Room 104"
              leftIcon={<DoorOpen className="w-4 h-4" />}
            />
          </div>

          <Input
            label="Login Email"
            value={displayEmail}
            disabled
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Textarea
            label="Note (Optional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="Responsibilities or desk notes..."
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingProfile}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Profile
            </Button>
          </div>
        </form>
      </section>

      {/* University & Office Settings */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">University &amp; Desk Details</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleApplyGalgotiasPreset}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Galgotias Preset
          </Button>
        </div>

        <form onSubmit={handleSaveOfficeSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="University Name"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="Galgotias University"
                leftIcon={<Building2 className="w-4 h-4" />}
                requiredIndicator
              />
            </div>
            <Input
              label="Short Code"
              value={collegeCode}
              onChange={(e) => setCollegeCode(e.target.value.toUpperCase())}
              placeholder="GU"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Greater Noida"
              leftIcon={<MapPin className="w-4 h-4" />}
            />
            <Input
              label="State"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="Uttar Pradesh"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <Input
              label="Desk Name"
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
              placeholder="Lost & Found Office"
              leftIcon={<Building2 className="w-4 h-4" />}
            />
            <Input
              label="Hours"
              value={officeHours}
              onChange={(e) => setOfficeHours(e.target.value)}
              placeholder="Mon – Sat, 9:00 AM – 5:00 PM"
              leftIcon={<Clock className="w-4 h-4" />}
            />
          </div>

          <Input
            label="Office Location"
            value={officeLocation}
            onChange={(e) => setOfficeLocation(e.target.value)}
            placeholder="Block A, Ground Floor, Security Desk"
            leftIcon={<MapPin className="w-4 h-4" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Email"
              type="email"
              value={officeEmail}
              onChange={(e) => setOfficeEmail(e.target.value)}
              placeholder="lostandfound@galgotiasuniversity.edu.in"
              leftIcon={<Mail className="w-4 h-4" />}
            />
            <Input
              label="Contact Phone"
              type="tel"
              value={officePhone}
              onChange={(e) => setOfficePhone(e.target.value)}
              placeholder="+91-120-4370000"
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          <Textarea
            label="Pickup Instructions"
            value={handoverInstructions}
            onChange={(e) => setHandoverInstructions(e.target.value)}
            rows={2}
            placeholder="Bring valid Student ID when collecting approved items."
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingOffice}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Settings
            </Button>
          </div>
        </form>
      </section>

      {/* Password */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Change Password</h2>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              leftIcon={<Lock className="w-4 h-4" />}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              isLoading={isUpdatingPassword}
              leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
            >
              Update Password
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
