import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Users,
  CheckCircle2,
  Layers,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

type ExportRange = '7d' | '30d' | '90d' | 'all';

export const AdminExportPage: React.FC = () => {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [range, setRange] = useState<ExportRange>('30d');
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);

  const handleExportExcel = async () => {
    if (!session?.access_token) {
      showToast({
        type: 'error',
        title: 'Session Expired',
        message: 'Please sign in as a College Admin.',
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(`/api/admin/export-excel?range=${encodeURIComponent(range)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Export failed (HTTP ${response.status}).`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        filenameMatch?.[1] ||
        `foundly-campus-report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setLastExportAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      showToast({
        type: 'success',
        title: 'Workbook Downloaded',
        message: `${filename} saved.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err.message || 'Could not generate Excel report.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const sheets = [
    { name: 'Summary', detail: 'KPIs & recovery rates', icon: Layers },
    { name: 'Lost Reports', detail: 'Category, location & status', icon: FileText },
    { name: 'Found Reports', detail: 'Storage bins & return dates', icon: FileText },
    { name: 'Claims', detail: 'Verification & handovers', icon: CheckCircle2 },
    { name: 'Campus Directory', detail: 'Accounts & activity counts', icon: Users },
  ];

  return (
    <div className="w-full max-w-4xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Export Reports</h1>
        {lastExportAt && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 tabular-nums">
            <Clock className="w-3.5 h-3.5" />
            Exported at {lastExportAt}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Excel Workbook (.xlsx)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                5 sanitized sheets · excludes private proofs &amp; secrets
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 shrink-0">
            <div className="w-full sm:w-44">
              <Select
                label="Date Range"
                value={range}
                onChange={(e) => setRange(e.target.value as ExportRange)}
                options={[
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '90d', label: 'Last 90 days' },
                  { value: 'all', label: 'All records' },
                ]}
              />
            </div>

            <Button
              variant="primary"
              onClick={handleExportExcel}
              isLoading={isExporting}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Download .xlsx
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sheets.map((sheet) => {
            const Icon = sheet.icon;
            return (
              <div
                key={sheet.name}
                className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-start gap-2.5"
              >
                <Icon className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{sheet.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sheet.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
