import React from 'react';
import { Search, ArrowRight, Lock } from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

export const HowItWorksPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();

  const steps = [
    {
      num: '01',
      title: 'Report lost or found',
      body: 'Submit item details, location, and an optional photo. Private marks stay hidden from public listings.',
    },
    {
      num: '02',
      title: 'Admin review & matching',
      body: 'Campus staff approve reports for the directory while automatic matching flags likely Lost-to-Found pairs.',
    },
    {
      num: '03',
      title: 'Claim ownership',
      body: 'Confirm a match in one click from your Lost Report, or submit ownership proof on any Found listing.',
    },
    {
      num: '04',
      title: 'Verified pickup',
      body: 'Once verified by campus administration, collect your item in person with your pickup code and student ID.',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          How Foundly works
        </h1>
        <p className="text-sm text-slate-500">
          Four steps from report to verified campus handover.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {steps.map((step) => (
          <div
            key={step.num}
            className="p-5 rounded-xl border border-slate-200/80 bg-white space-y-2"
          >
            <span className="font-mono text-xs font-semibold text-indigo-600">{step.num}</span>
            <h2 className="text-[15px] font-semibold text-slate-900">{step.title}</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl border border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-600">
            Reporter identities and private verification marks are visible only to campus administrators.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(user ? '/student/browse' : '/browse')}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          >
            Browse
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(user ? '/student' : '/signup')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            {user ? 'Open Portal' : 'Get Started'}
          </Button>
        </div>
      </div>
    </div>
  );
};
