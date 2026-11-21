import React from 'react';
import { MapPin, Clock, Mail, Phone, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_OFFICE_CONFIG } from '../lib/supabase';

export const StudentHelpPage: React.FC = () => {
  const { user, configuredCollege } = useAuth();

  const opInfo = {
    contactName: configuredCollege?.office_name || DEFAULT_OFFICE_CONFIG.office_name,
    officeLocation: configuredCollege?.office_location || DEFAULT_OFFICE_CONFIG.office_location,
    workingHours: configuredCollege?.office_hours || DEFAULT_OFFICE_CONFIG.office_hours,
    contactEmail: configuredCollege?.contact_email || DEFAULT_OFFICE_CONFIG.contact_email,
    contactPhone: configuredCollege?.contact_phone || DEFAULT_OFFICE_CONFIG.contact_phone,
    handoverInstructions:
      configuredCollege?.pickup_instructions || DEFAULT_OFFICE_CONFIG.pickup_instructions,
  };

  const faqs = [
    {
      q: 'Report a lost or found item',
      a: 'Use Report Lost or Report Found with location, date, and private marks. Admins review before publishing.',
    },
    {
      q: 'Claim an item',
      a: 'Open a Found listing and click "This Is My Item" (if you have a Lost Report) or "Claim This Item" to submit proof.',
    },
    {
      q: 'Verification',
      a: 'College Admins compare your claim proof against private report marks. You will be notified once reviewed.',
    },
    {
      q: 'Pickup & handover',
      a: 'Bring your Student ID and pickup code to the Lost & Found Office to complete verified handover.',
    },
  ];

  return (
    <div
      className={`w-full max-w-3xl space-y-6 ${!user ? 'mx-auto px-4 sm:px-6 py-10' : ''}`}
      id="student-help-root"
    >
      <h1 className="text-xl font-bold text-slate-900">Help &amp; Office Info</h1>

      {/* Office Info */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>{opInfo.contactName}</span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <dt className="text-slate-400">Location</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{opInfo.officeLocation}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <dt className="text-slate-400">Hours</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{opInfo.workingHours}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <dt className="text-slate-400">Email</dt>
              <dd className="font-medium text-slate-800 mt-0.5 truncate">{opInfo.contactEmail}</dd>
            </div>
          </div>

          {opInfo.contactPhone && (
            <div className="flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <dt className="text-slate-400">Phone</dt>
                <dd className="font-medium text-slate-800 mt-0.5 tabular-nums">{opInfo.contactPhone}</dd>
              </div>
            </div>
          )}
        </dl>

        {opInfo.handoverInstructions && (
          <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">
            {opInfo.handoverInstructions}
          </p>
        )}
      </div>

      {/* Quick Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {faqs.map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-1.5"
          >
            <h2 className="text-sm font-semibold text-slate-900">{item.q}</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
