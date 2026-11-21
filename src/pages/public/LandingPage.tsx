import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { Search, PlusCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user, configuredCollege } = useAuth();

  const collegeName = configuredCollege?.name || 'Galgotias University';

  return (
    <div className="w-full flex flex-col">
      {/* Hero */}
      <section className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
        <p className="text-xs font-semibold text-indigo-600 tracking-wide mb-4">
          {collegeName}
        </p>

        <h1 className="text-4xl sm:text-5xl md:text-[56px] font-bold text-slate-900 tracking-tight leading-[1.08] max-w-2xl mx-auto">
          Lost &amp; found for your campus.
        </h1>

        <p className="text-base sm:text-lg text-slate-500 max-w-md mx-auto mt-4 leading-relaxed">
          Report lost or found items, get matched automatically, and recover belongings through campus administration.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate(user ? '/student/browse' : '/browse')}
            leftIcon={<Search className="w-4 h-4" />}
          >
            Browse Items
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/student/report-lost')}
            leftIcon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          >
            Report Lost
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/student/report-found')}
            leftIcon={<PlusCircle className="w-4 h-4 text-emerald-600" />}
          >
            Report Found
          </Button>
        </div>
      </section>

      {/* Steps */}
      <section className="w-full border-t border-slate-200/80 bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
          <div className="flex items-end justify-between gap-4 mb-10">
            <h2 className="text-lg font-semibold text-slate-900">How it works</h2>
            <button
              type="button"
              onClick={() => navigate('/how-it-works')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <span>Learn more</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-slate-200/80 bg-[#FAFAFB]">
              <span className="font-mono text-xs font-semibold text-indigo-600">01</span>
              <h3 className="text-[15px] font-semibold text-slate-900 mt-3">Report an item</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Log lost or found belongings with location, photo, and private identifying marks.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200/80 bg-[#FAFAFB]">
              <span className="font-mono text-xs font-semibold text-indigo-600">02</span>
              <h3 className="text-[15px] font-semibold text-slate-900 mt-3">Match &amp; claim</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Get notified on potential matches and submit a one-click or proof-backed claim.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200/80 bg-[#FAFAFB]">
              <span className="font-mono text-xs font-semibold text-indigo-600">03</span>
              <h3 className="text-[15px] font-semibold text-slate-900 mt-3">Verified handover</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Campus admins verify ownership and release the item in person.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
