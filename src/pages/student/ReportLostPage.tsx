import React, { useState, FormEvent } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage, safeInsert } from '../../lib/supabase';
import { CheckCircle2, Send, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { FileUpload } from '../../components/ui/FileUpload';

const CATEGORY_OPTIONS = [
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'ID_AND_CARDS', label: 'IDs & Wallets' },
  { value: 'KEYS', label: 'Keys' },
  { value: 'BAGS_AND_BACKPACKS', label: 'Bags & Backpacks' },
  { value: 'CLOTHING_AND_ACCESSORIES', label: 'Clothing' },
  { value: 'BOOKS_AND_STATIONERY', label: 'Books & Stationery' },
  { value: 'BOTTLES_AND_MUGS', label: 'Bottles' },
  { value: 'JEWELRY_AND_WATCHES', label: 'Jewelry & Watches' },
  { value: 'OTHER', label: 'Other' },
];

const CONTACT_PREFERENCES = [
  { value: 'IN_APP', label: 'In-App Notification' },
  { value: 'EMAIL', label: 'Campus Email' },
  { value: 'CAMPUS_OFFICE', label: 'Lost & Found Office' },
  { value: 'PHONE', label: 'Phone / SMS' },
];

export const ReportLostPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { user, profile, configuredCollege } = useAuth();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<string>('ELECTRONICS');
  const [dateLost, setDateLost] = useState('');
  const [approximateTime, setApproximateTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [uniqueDetails, setUniqueDetails] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [contactPreference, setContactPreference] = useState<string>('IN_APP');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!itemName.trim()) errs.itemName = 'Required.';
    if (!category) errs.category = 'Required.';
    if (!dateLost) errs.dateLost = 'Required.';
    if (!location.trim()) errs.location = 'Required.';
    if (!description.trim()) errs.description = 'Required.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const uploadImage = async (file: File, userId: string): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image exceeds 5MB limit.');
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('PNG, JPG, and WEBP only.');
    }

    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${userId}/lost-${uniqueName}`;

    const { error } = await supabase.storage
      .from('item-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('item-images').getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!user) {
      showToast({
        type: 'error',
        title: 'Sign in required',
        message: 'Please log in to submit a report.',
      });
      return;
    }

    const collegeId = profile?.college_id || configuredCollege?.id;
    if (!collegeId) {
      showToast({
        type: 'error',
        title: 'Campus missing',
        message: 'Your account is not linked to a campus.',
      });
      return;
    }

    setIsLoading(true);

    try {
      let uploadedImagePath: string | null = null;
      if (image && isSupabaseConfigured()) {
        uploadedImagePath = await uploadImage(image, user.id);
      }

      if (isSupabaseConfigured()) {
        const { data: createdItem, error } = await safeInsert<{ id: string }>(
          'items',
          {
            user_id: user.id,
            college_id: collegeId,
            type: 'lost',
            item_name: itemName.trim(),
            category,
            description: description.trim(),
            brand: brand.trim() || null,
            color: color.trim() || null,
            unique_marks: uniqueDetails.trim() || null,
            date: dateLost,
            approximate_time: approximateTime || null,
            location: location.trim(),
            image_path: uploadedImagePath,
            contact_preference: contactPreference,
            status: 'pending',
          },
          { select: 'id', single: true }
        );

        if (error) {
          setIsLoading(false);
          showToast({
            type: 'error',
            title: 'Submission failed',
            message: getFriendlyAuthErrorMessage(error),
          });
          return;
        }

        try {
          await supabase.from('activity_logs').insert({
            actor_id: user.id,
            college_id: collegeId,
            action: 'REPORT_CREATED',
            entity_type: 'ITEM',
            entity_id: createdItem?.id || null,
            metadata: { type: 'lost', item_name: itemName.trim() },
          });
        } catch (logErr) {
          console.warn('Activity log insert skipped:', logErr);
        }

        if (createdItem?.id) {
          try {
            const { data: admins } = await supabase
              .from('profiles')
              .select('id')
              .eq('college_id', collegeId)
              .eq('role', 'college_admin');

            if (admins && admins.length > 0) {
              await supabase.from('notifications').insert(
                admins.map((admin) => ({
                  user_id: admin.id,
                  college_id: collegeId,
                  title: 'New lost item report',
                  message: `Lost report for "${itemName.trim()}" awaiting approval.`,
                  type: `REPORT_SUBMITTED:${createdItem.id}`,
                  read: false,
                }))
              );
            }
          } catch (notifErr) {
            console.warn('Admin notification insert skipped:', notifErr);
          }
        }
      }

      setIsLoading(false);
      setIsSuccess(true);
      showToast({
        type: 'success',
        title: 'Lost report submitted',
        message: 'Pending admin approval. Matches will appear automatically once approved.',
      });
    } catch (err: any) {
      setIsLoading(false);
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Could not submit report.',
      });
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Report Lost</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/student')}>
          Cancel
        </Button>
      </div>

      {isSuccess ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Lost report submitted</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            &ldquo;{itemName}&rdquo; is awaiting admin approval. You&apos;ll be notified if a matching found item appears.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setItemName('');
                setDateLost('');
                setApproximateTime('');
                setLocation('');
                setDescription('');
                setBrand('');
                setColor('');
                setUniqueDetails('');
                setImage(null);
                setIsSuccess(false);
              }}
            >
              Report Another
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate('/student/reports')}>
              My Reports
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400">Item details</h2>

            <Input
              label="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Blue Smartphone, Black Wallet"
              error={errors.itemName}
              requiredIndicator
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={CATEGORY_OPTIONS}
                error={errors.category}
                requiredIndicator
              />
              <Input
                label="Brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Samsung"
              />
              <Input
                label="Color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Blue"
              />
            </div>

            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Case, size, condition, or visible details..."
              error={errors.description}
              rows={2}
              requiredIndicator
            />
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400">Where, when &amp; proof</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <Input
                  label="Date lost"
                  type="date"
                  value={dateLost}
                  onChange={(e) => setDateLost(e.target.value)}
                  error={errors.dateLost}
                  requiredIndicator
                />
              </div>
              <div className="sm:col-span-1">
                <Input
                  label="Time (optional)"
                  type="time"
                  value={approximateTime}
                  onChange={(e) => setApproximateTime(e.target.value)}
                />
              </div>
              <div className="sm:col-span-1">
                <Select
                  label="Contact via"
                  value={contactPreference}
                  onChange={(e) => setContactPreference(e.target.value)}
                  options={CONTACT_PREFERENCES}
                />
              </div>
            </div>

            <Input
              label="Last seen location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. A Block 105, Central Library"
              error={errors.location}
              leftIcon={<MapPin className="w-4 h-4" />}
              requiredIndicator
            />

            <Textarea
              label="Private identifying marks (admin only)"
              value={uniqueDetails}
              onChange={(e) => setUniqueDetails(e.target.value)}
              placeholder="Serial number, lock screen, engravings — hidden from students"
              rows={2}
            />

            <FileUpload
              label="Reference photo (optional)"
              value={image}
              onChange={(file) => setImage(file)}
              helperText="PNG, JPG, WEBP up to 5MB"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/student')}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Report
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
