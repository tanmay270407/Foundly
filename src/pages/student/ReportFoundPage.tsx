import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, getFriendlyAuthErrorMessage } from '../../lib/supabase';
import { 
  CheckCircle2, 
  Send, 
  MapPin, 
  Lock, 
  Archive,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { FileUpload } from '../../components/ui/FileUpload';

const CATEGORY_OPTIONS = [
  { value: 'ELECTRONICS', label: 'Electronics & Gadgets' },
  { value: 'ID_AND_CARDS', label: 'Student ID, Wallet, or Cards' },
  { value: 'KEYS', label: 'Keys & Fobs' },
  { value: 'BAGS_AND_BACKPACKS', label: 'Bags & Backpacks' },
  { value: 'CLOTHING_AND_ACCESSORIES', label: 'Clothing & Jackets' },
  { value: 'BOOKS_AND_STATIONERY', label: 'Books, Notebooks & Stationery' },
  { value: 'BOTTLES_AND_MUGS', label: 'Bottles & Thermoses' },
  { value: 'JEWELRY_AND_WATCHES', label: 'Jewelry & Watches' },
  { value: 'OTHER', label: 'Other Item' },
];

const CONTACT_PREFERENCES = [
  { value: 'IN_APP', label: 'In-App Notification (Recommended)' },
  { value: 'EMAIL', label: 'Campus Email' },
  { value: 'CAMPUS_OFFICE', label: 'Campus Lost & Found Office' },
  { value: 'PHONE', label: 'Phone Call / SMS' },
];

export const ReportFoundPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { user, profile } = useAuth();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<string>('ELECTRONICS');
  const [dateFound, setDateFound] = useState('');
  const [approximateTime, setApproximateTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [uniqueDetails, setUniqueDetails] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [currentLocation, setCurrentLocation] = useState('');
  const [contactPreference, setContactPreference] = useState<string>('IN_APP');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCollegeDeactivated, setIsCollegeDeactivated] = useState(false);

  useEffect(() => {
    if (profile?.college_id && isSupabaseConfigured()) {
      supabase
        .from('colleges')
        .select('*')
        .eq('id', profile.college_id)
        .single()
        .then(({ data }) => {
          if (data?.domain?.startsWith('[DEACTIVATED]')) {
            setIsCollegeDeactivated(true);
          }
        });
    }
  }, [profile?.college_id]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!itemName.trim()) errs.itemName = 'Item name is required.';
    if (!category) errs.category = 'Please choose a category.';
    if (!dateFound) errs.dateFound = 'Date found is required.';
    if (!location.trim()) errs.location = 'Location where item was discovered is required.';
    if (!currentLocation.trim()) errs.currentLocation = 'Current custody location is required.';
    if (!description.trim()) errs.description = 'Please provide a general description.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const uploadImage = async (file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size exceeds the 5MB limit.');
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. PNG, JPG, and WEBP images are allowed.');
    }

    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `found/${uniqueName}`;

    const { data, error } = await supabase.storage
      .from('item-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('item-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!user) {
      showToast({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please sign in to report a found item.',
      });
      return;
    }

    const collegeId = profile?.college_id;
    if (!collegeId) {
      showToast({
        type: 'error',
        title: 'Profile Affiliation Missing',
        message: 'Your user profile is not associated with any college campus.',
      });
      return;
    }

    setIsLoading(true);

    try {
      let uploadedImagePath: string | null = null;
      if (image && isSupabaseConfigured()) {
        uploadedImagePath = await uploadImage(image);
      }

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('items')
          .insert({
            user_id: user.id,
            college_id: collegeId,
            type: 'found',
            item_name: itemName.trim(),
            category: category,
            description: description.trim(),
            brand: brand.trim() || null,
            color: color.trim() || null,
            unique_marks: uniqueDetails.trim() || null,
            date: dateFound,
            approximate_time: approximateTime || null,
            location: location.trim(),
            current_storage_location: currentLocation.trim(),
            storage_location: currentLocation.trim(), // legacy column backup
            image_path: uploadedImagePath,
            contact_preference: contactPreference,
            status: 'pending'
          });

        if (error) {
          setIsLoading(false);
          showToast({
            type: 'error',
            title: 'Submission Failed',
            message: getFriendlyAuthErrorMessage(error),
          });
          return;
        }

        // Create initial Activity Log
        await supabase
          .from('activity_logs')
          .insert({
            actor_id: user.id,
            college_id: collegeId,
            action: 'REPORT_CREATED',
            entity_type: 'ITEM',
            metadata: { type: 'found', item_name: itemName.trim() }
          });
      }

      setIsLoading(false);
      setIsSuccess(true);
      showToast({
        type: 'success',
        title: 'Found Report Submitted',
        message: 'Your found report has been submitted for administrative review.',
      });
    } catch (err: any) {
      setIsLoading(false);
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'An unexpected error occurred.',
      });
    }
  };

  if (isCollegeDeactivated) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in" id="deactivated-college-notice">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Report a Found Item</h1>
            <p className="text-xs text-slate-500 mt-1">Help return unattended campus property to its rightful owner</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/student')}>
            Back
          </Button>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">College Directory Deactivated</h2>
            <p className="text-xs text-rose-800 max-w-md mx-auto leading-relaxed">
              Your college campus directory has been temporarily deactivated by the platform owner. Students cannot submit new lost or found reports under deactivated colleges.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Button size="sm" variant="outline" onClick={() => navigate('/student')}>
              Go back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Report a Found Item</h1>
          <p className="text-xs text-slate-500 mt-1">
            Help return unattended campus property to its rightful owner
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/student')}>
          Cancel
        </Button>
      </div>

      {isSuccess ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Found Report Logged</h2>
            <p className="text-xs text-emerald-800 max-w-md mx-auto mt-1 leading-relaxed">
              Thank you for helping keep our campus honest. Your found report for <strong>"{itemName}"</strong> is submitted with state <code className="bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono font-semibold">PENDING</code>. It is awaiting college staff approval before appearing in public listings.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button size="sm" variant="outline" onClick={() => {
              setItemName('');
              setDateFound('');
              setApproximateTime('');
              setLocation('');
              setDescription('');
              setBrand('');
              setColor('');
              setUniqueDetails('');
              setImage(null);
              setCurrentLocation('');
              setIsSuccess(false);
            }}>
              Report Another Item
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate('/student/activity')}>
              View in My Activity
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group 1: General Item Details */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. General Details
            </h2>

            <Input
              label="Item Name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Black Wireless Earbuds, Spiral Notebook, Hydro Flask..."
              error={errors.itemName}
              requiredIndicator
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={CATEGORY_OPTIONS}
                error={errors.category}
                requiredIndicator
              />

              <Input
                label="Brand / Logo (Optional)"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Sony, Anker, Casio..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Silver, Olive Green..."
              />

              <Input
                label="General Public Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief public overview of item condition..."
                error={errors.description}
                requiredIndicator
              />
            </div>
          </div>

          {/* Group 2: Time and Discovery Location */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Discovery Circumstances
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date Found"
                type="date"
                value={dateFound}
                onChange={(e) => setDateFound(e.target.value)}
                error={errors.dateFound}
                requiredIndicator
              />

              <Input
                label="Approximate Time (Optional)"
                type="time"
                value={approximateTime}
                onChange={(e) => setApproximateTime(e.target.value)}
              />
            </div>

            <Input
              label="Location Where Found"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bench outside Physics Hall, Desk 42 in Computer Lab B..."
              error={errors.location}
              leftIcon={<MapPin className="w-4 h-4" />}
              requiredIndicator
            />
          </div>

          {/* Group 3: Current Storage & Sensitive Verification (Privacy Protected) */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              3. Custody & Ownership Verification
            </h2>

            <Input
              label="Current Storage / Custody Location"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g. Handed to Student Center Front Desk, With Finder (Dorm 4B)..."
              error={errors.currentLocation}
              leftIcon={<Archive className="w-4 h-4" />}
              helperText="Specify where the item is physically kept or who currently holds it"
              requiredIndicator
            />

            {/* Privacy Guard Notice */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Admin-Only Private Verification Information</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                To prevent false claims, do not publicly disclose sensitive serial numbers, internal wallet cards, or secret engraving marks. Enter them below for the College Admin only.
              </p>
              <Textarea
                label="Confidential Identifying Details (Private)"
                value={uniqueDetails}
                onChange={(e) => setUniqueDetails(e.target.value)}
                placeholder="e.g. Serial #SN-49102, Name on ID card inside wallet, Lock screen photo description..."
                helperText="Will remain hidden from the public feed and used solely during claim verification."
                rows={2}
              />
            </div>

            <FileUpload
              label="Item Photo (Optional)"
              value={image}
              onChange={(file) => setImage(file)}
              helperText="Upload reference image (PNG, JPG, WEBP, max 5MB)"
            />

            <Select
              label="Contact Preference"
              value={contactPreference}
              onChange={(e) => setContactPreference(e.target.value)}
              options={CONTACT_PREFERENCES}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Found Report
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
