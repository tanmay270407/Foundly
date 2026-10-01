import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  HelpCircle,
  Clock,
  Compass
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-4xl mx-auto px-4 pt-16 pb-12 text-center flex flex-col items-center">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
          <Building2 className="w-3.5 h-3.5" />
          <span>Campus-Exclusive Lost & Found</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          FOUNDLY
        </h1>

        <p className="text-xl sm:text-2xl font-medium text-indigo-600 mt-2 tracking-tight">
          Helping lost items find their way home.
        </p>

        <p className="text-sm sm:text-base text-slate-500 max-w-lg mt-3 leading-relaxed">
          A modern, private lost-and-found hub built strictly for your college campus. Report missing items, match records instantly, and safely claim what is yours.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8 w-full max-w-md">
          <Button
            size="lg"
            variant="primary"
            className="flex-1 min-w-[140px]"
            onClick={() => navigate('/student/report-lost')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Report Lost
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="flex-1 min-w-[140px]"
            onClick={() => navigate('/student/report-found')}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          >
            Report Found
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => navigate('/student/browse')}
            leftIcon={<Search className="w-4 h-4 text-slate-500" />}
          >
            Find an Item
          </Button>
        </div>
      </section>

      {/* 3-Step Process: Report -> Match -> Recover */}
      <section className="w-full max-w-4xl mx-auto px-4 py-12 border-t border-slate-100">
        <div className="text-center mb-10">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            How Foundly Works
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Three simple steps to return items to their rightful owners
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1: Report */}
          <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-left flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-sm mb-4">
                1
              </div>
              <h3 className="text-base font-semibold text-slate-900">Report</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Log what you lost or found with key details, approximate campus location, and photo.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center text-[11px] font-medium text-indigo-600">
              <span>Quick structured form</span>
            </div>
          </div>

          {/* Step 2: Match */}
          <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-left flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-sm mb-4">
                2
              </div>
              <h3 className="text-base font-semibold text-slate-900">Match</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Smart suggestions cross-reference reports within your college to discover potential matches.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center text-[11px] font-medium text-indigo-600">
              <span>AI-assisted matching</span>
            </div>
          </div>

          {/* Step 3: Recover */}
          <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-left flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-sm mb-4">
                3
              </div>
              <h3 className="text-base font-semibold text-slate-900">Recover</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Submit an identity claim. Your campus administrator verifies ownership and facilitates safe handover.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center text-[11px] font-medium text-indigo-600">
              <span>Verified administrator handover</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Architecture Pillars */}
      <section className="w-full max-w-4xl mx-auto px-4 py-8 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-semibold text-slate-900">College-based</h4>
              <p className="text-[11px] text-slate-500">Separated per campus community</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-semibold text-slate-900">Secure & Private</h4>
              <p className="text-[11px] text-slate-500">Identifying marks protected</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-semibold text-slate-900">AI-assisted</h4>
              <p className="text-[11px] text-slate-500">Intelligent item matching</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
