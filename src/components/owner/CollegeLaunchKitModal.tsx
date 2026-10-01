import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Rocket, 
  ShieldCheck, 
  Server, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Info,
  Clock,
  Ban,
  Activity,
  Lock,
  Mail,
  Phone,
  FileText
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { 
  getCollegeLaunchData, 
  saveCollegeLaunchData, 
  CollegeLaunchData, 
  ChecklistItem, 
  LaunchStatus,
  CollegeOperationalInfo 
} from '../../lib/collegeLaunch';

interface CollegeLaunchKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  college: any;
  onRefresh?: () => void;
}

export const CollegeLaunchKitModal: React.FC<CollegeLaunchKitModalProps> = ({
  isOpen,
  onClose,
  college,
  onRefresh
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [launchData, setLaunchData] = useState<CollegeLaunchData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>('SETUP');
  
  // Operational info state
  const [opInfo, setOpInfo] = useState<CollegeOperationalInfo>({
    contactName: 'Campus Security Desk',
    officeLocation: 'Campus Security / Lost & Found Office',
    workingHours: 'Monday - Friday, 9:00 AM - 5:00 PM',
    contactEmail: 'lostandfound@college.edu',
    contactPhone: '',
    handoverInstructions: 'Please present student ID or claim QR code at pickup.',
    additionalStudentInstructions: 'Verify item details before visiting the office.'
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && college?.id) {
      setIsLoading(true);
      getCollegeLaunchData(college.id).then((data) => {
        setLaunchData(data);
        setChecklist(data.checklist || []);
        setLaunchStatus(data.launchStatus || 'SETUP');
        if (data.operationalInfo) {
          setOpInfo(data.operationalInfo);
        }
        setIsLoading(false);
      });
    }
  }, [isOpen, college?.id]);

  const handleToggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
    setValidationError(null);
  };

  const handleSaveLaunchData = async () => {
    if (!college?.id || !user?.id) return;

    setValidationError(null);
    setIsSaving(true);

    try {
      const result = await saveCollegeLaunchData(
        college.id,
        user.id,
        checklist,
        launchStatus,
        opInfo,
        launchStatus === 'ACTIVE' ? profile?.full_name || user.email || 'Foundly Owner' : undefined
      );

      if (!result.success && result.incompleteCritical.length > 0) {
        setValidationError(`Cannot activate college. ${result.incompleteCritical.length} critical checklist items remain incomplete: ${result.incompleteCritical.join(', ')}`);
        setIsSaving(false);
        return;
      }

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Launch Configuration Saved 🎉',
          message: `Onboarding checklist, launch status (${launchStatus}), and campus operational info updated for ${college.name}.`,
        });
        if (onRefresh) onRefresh();
        onClose();
      } else {
        throw new Error('Save failed');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not persist launch kit modifications.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!college) return null;

  const completedCount = checklist.filter((i) => i.completed).length;
  const criticalCount = checklist.filter((i) => i.isCritical).length;
  const criticalCompletedCount = checklist.filter((i) => i.isCritical && i.completed).length;
  const progressPercent = Math.round((completedCount / (checklist.length || 1)) * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`College Launch Readiness Kit — ${college.name}`}
      description={`Campus Code: ${college.code} | Controlled, repeatable launch workflow and verification checklist.`}
    >
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading rollout readiness & verification checks...</div>
      ) : (
        <div className="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {/* Top Status & Launch Control Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Launch Readiness State</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`font-bold text-sm ${
                  launchStatus === 'ACTIVE' ? 'text-emerald-600' :
                  launchStatus === 'READY_FOR_LAUNCH' ? 'text-indigo-600' :
                  launchStatus === 'PAUSED' ? 'text-rose-600' : 'text-slate-900'
                }`}>
                  {launchStatus}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  {progressPercent}% Complete ({criticalCompletedCount}/{criticalCount} Critical)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">Set State:</label>
              <select
                value={launchStatus}
                onChange={(e) => {
                  setLaunchStatus(e.target.value as LaunchStatus);
                  setValidationError(null);
                }}
                className="px-2.5 py-1 rounded-xl bg-white border border-slate-300 font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="SETUP">SETUP</option>
                <option value="READY_FOR_LAUNCH">READY_FOR_LAUNCH</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
              </select>
            </div>
          </div>

          {/* Validation Error Banner if trying to activate with incomplete critical checks */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Activation Blocked</span>
              </div>
              <p className="text-[11px] leading-relaxed pl-6">{validationError}</p>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between font-bold text-slate-700">
              <span>Launch Readiness</span>
              <span>{completedCount} / {checklist.length} Checklist Items</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${criticalCompletedCount === criticalCount ? 'bg-emerald-600' : 'bg-indigo-600'}`} 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>

          {/* Admin Readiness Summary */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>College Admin Onboarding Status</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-700">
              <div className="p-2 rounded-xl bg-white border border-indigo-100 flex items-center justify-between">
                <span>Assigned Administrator</span>
                {launchData?.adminReadiness.hasApprovedAdmin ? (
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    {launchData.adminReadiness.adminEmail || 'ASSIGNED'}
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">NOT ASSIGNED</span>
                )}
              </div>
              <div className="p-2 rounded-xl bg-white border border-indigo-100 flex items-center justify-between">
                <span>Admin Login & Workflow</span>
                {launchData?.adminReadiness.accessedAdminPanel ? (
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">VERIFIED</span>
                ) : (
                  <span className="text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded">PENDING</span>
                )}
              </div>
            </div>
          </div>

          {/* Operational Contact Configuration */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Campus Operational Information</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Contact Name / Office Title"
                value={opInfo.contactName || ''}
                onChange={(e) => setOpInfo({ ...opInfo, contactName: e.target.value })}
                placeholder="e.g. Campus Security Desk"
              />
              <Input
                label="Physical Office Location"
                value={opInfo.officeLocation || ''}
                onChange={(e) => setOpInfo({ ...opInfo, officeLocation: e.target.value })}
                placeholder="e.g. Student Union, Room 104"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Working Hours"
                value={opInfo.workingHours || ''}
                onChange={(e) => setOpInfo({ ...opInfo, workingHours: e.target.value })}
                placeholder="Mon-Fri 9AM - 5PM"
              />
              <Input
                label="Contact Email"
                value={opInfo.contactEmail || ''}
                onChange={(e) => setOpInfo({ ...opInfo, contactEmail: e.target.value })}
                placeholder="lostandfound@college.edu"
              />
              <Input
                label="Contact Phone (Optional)"
                value={opInfo.contactPhone || ''}
                onChange={(e) => setOpInfo({ ...opInfo, contactPhone: e.target.value })}
                placeholder="+1 (555) 019-2831"
              />
            </div>

            <Textarea
              label="Student Pickup & Handover Instructions"
              value={opInfo.handoverInstructions || ''}
              onChange={(e) => setOpInfo({ ...opInfo, handoverInstructions: e.target.value })}
              placeholder="e.g. Please present valid student ID or claim QR code at pickup."
              rows={2}
            />
          </div>

          {/* 23 Launch Checklist Items */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Re-usable 23-Point Launch Checklist
            </h3>
            <div className="space-y-1.5 border border-slate-200/80 rounded-2xl p-3 bg-white">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleItem(item.id)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className={`text-xs font-medium ${item.completed ? 'text-slate-900 line-through/50' : 'text-slate-700'}`}>
                    {item.label}
                  </span>

                  <div className="ml-auto flex items-center gap-1.5">
                    {item.isCritical && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        CRITICAL
                      </span>
                    )}
                    {item.autoVerified && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        Auto-verified
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Final Launch Approval Record if approved */}
          {launchData?.approvedBy && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between">
              <div>
                <p className="font-bold">Final Launch Approved</p>
                <p className="text-[10px] text-emerald-800">
                  Approved by {launchData.approvedBy} on {new Date(launchData.approvedAt || '').toLocaleDateString()}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveLaunchData} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
              Save Readiness Kit
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
