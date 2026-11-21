import React from 'react';
import {
  FileText,
  CheckSquare,
  Handshake,
  ShieldCheck,
  MapPin,
  Clock,
  Mail,
  ArrowRight,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { Button } from '../../components/ui/Button';

export const AdminGuidePage: React.FC = () => {
  const { configuredCollege } = useAuth();
  const { navigate } = useRouter();

  const steps = [
    {
      title: '1. Moderate Reports',
      detail: 'Approve valid Lost & Found reports to publish them in the campus catalog.',
      icon: FileText,
    },
    {
      title: '2. Tag Storage',
      detail: 'Assign shelf locations and print QR tags for physical found items.',
      icon: ShieldCheck,
    },
    {
      title: '3. Verify Claims',
      detail: 'Compare claimant explanations, linked lost reports, and private marks.',
      icon: CheckSquare,
    },
    {
      title: '4. Confirm Handover',
      detail: 'Check student ID in person and confirm return to close the case.',
      icon: Handshake,
    },
    {
      title: '5. Manage Access',
      detail: 'Promote campus staff or revoke admin access under Students.',
      icon: Users,
    },
    {
      title: '6. Track & Export',
      detail: 'Monitor recovery rates in Analytics and download Excel reports.',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="w-full max-w-4xl space-y-6 animate-fade-in" id="admin-guide-root">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admin Guide</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/admin/profile')}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Edit Desk Info
        </Button>
      </div>

      {/* Campus Desk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Office</span>
          </div>
          <p className="text-xs font-medium text-slate-900 leading-relaxed">
            {configuredCollege?.office_location || 'Campus Security & Student Center Desk'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Hours</span>
          </div>
          <p className="text-xs font-medium text-slate-900">
            {configuredCollege?.office_hours || 'Monday – Friday, 9:00 AM – 5:00 PM'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Mail className="w-3.5 h-3.5 text-indigo-600" />
            <span>Contact</span>
          </div>
          <p className="text-xs font-medium text-slate-900 break-all">
            {configuredCollege?.contact_email || 'lostandfound@campus.edu'}
          </p>
          {configuredCollege?.contact_phone && (
            <p className="text-xs text-slate-500 tabular-nums">{configuredCollege.contact_phone}</p>
          )}
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-2"
            >
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{step.title}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{step.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
