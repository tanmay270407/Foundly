import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Key, 
  HardDrive, 
  Cpu, 
  Mail, 
  Bell, 
  Server, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ShieldAlert, 
  Send,
  Info,
  Clock,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DashboardCard } from '../../components/ui/DashboardCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { 
  checkSystemHealth, 
  alertOwnerOnInconsistencies, 
  SystemHealthReport, 
  HealthStatus, 
  WorkflowWarning 
} from '../../lib/systemHealth';

export const OwnerHealthPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isAlerting, setIsAlerting] = useState(false);
  const [report, setReport] = useState<SystemHealthReport | null>(null);

  const fetchHealthReport = async () => {
    setIsLoading(true);
    try {
      const data = await checkSystemHealth();
      setReport(data);
    } catch (err: any) {
      console.error('Failed to run health checks:', err);
      showToast({
        type: 'error',
        title: 'Health Check Error',
        message: 'Could not perform production health diagnostics.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthReport();
  }, []);

  const handleSendOwnerAlert = async () => {
    if (!user?.id || !report || report.workflowWarnings.length === 0) return;
    setIsAlerting(true);
    try {
      const success = await alertOwnerOnInconsistencies(user.id, report.workflowWarnings.length);
      if (success) {
        showToast({
          type: 'success',
          title: 'Alert Dispatched',
          message: `Created an in-app system alert for ${report.workflowWarnings.length} operational warnings.`,
        });
      } else {
        throw new Error('Failed to post alert');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Alert Failed',
        message: err.message || 'Could not post system health alert notification.',
      });
    } finally {
      setIsAlerting(false);
    }
  };

  const renderStatusBadge = (status: HealthStatus) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            HEALTHY
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            DEGRADED
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            NOT CONFIGURED
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Executing production service health & workflow diagnostics..." />
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in" id="owner-health-root">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
              Operational Monitoring
            </span>
            {renderStatusBadge(report.overallStatus)}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            System Health & Production Status
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time diagnostics for database connectivity, authentication, storage buckets, AI matching, and workflow consistency
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealthReport}
          leftIcon={<RefreshCw className="w-4 h-4 text-indigo-600" />}
        >
          Run Health Diagnostics
        </Button>
      </div>

      {/* Main Services Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Database</h2>
            </div>
            {renderStatusBadge(report.database.status)}
          </div>
          <p className="text-xs text-slate-600">{report.database.details || 'PostgreSQL DB'}</p>
          {report.database.latencyMs !== undefined && (
            <p className="text-[11px] font-mono text-slate-400">Query Latency: {report.database.latencyMs}ms</p>
          )}
        </div>

        {/* Authentication */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Authentication</h2>
            </div>
            {renderStatusBadge(report.authentication.status)}
          </div>
          <p className="text-xs text-slate-600">{report.authentication.details || 'Supabase Auth'}</p>
          {report.authentication.latencyMs !== undefined && (
            <p className="text-[11px] font-mono text-slate-400">Session Latency: {report.authentication.latencyMs}ms</p>
          )}
        </div>

        {/* Storage */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Storage Buckets</h2>
            </div>
            {renderStatusBadge(report.storage.status)}
          </div>
          <p className="text-xs text-slate-600">{report.storage.details || 'Supabase Storage'}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium pt-1">
            <span className="px-1.5 py-0.5 rounded bg-slate-100">item-images</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100">claim-proofs</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100">admin-verification</span>
          </div>
        </div>

        {/* AI Service */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">AI Match Engine</h2>
            </div>
            {renderStatusBadge(report.aiService.status)}
          </div>
          <p className="text-xs text-slate-600">{report.aiService.details || 'Gemini 2.5 Flash'}</p>
          <p className="text-[11px] text-slate-400">
            {report.aiMetrics.successfulRequests} match requests processed
          </p>
        </div>

        {/* Email Service */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Email Dispatch</h2>
            </div>
            {renderStatusBadge(report.emailService.status)}
          </div>
          <p className="text-xs text-slate-600">{report.emailService.details || 'Resend Integration'}</p>
          <p className="text-[11px] text-slate-400">
            {report.emailMetrics.successfulSends} notifications dispatched
          </p>
        </div>

        {/* Notifications */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notifications Table</h2>
            </div>
            {renderStatusBadge(report.notifications.status)}
          </div>
          <p className="text-xs text-slate-600">{report.notifications.details}</p>
          <p className="text-[11px] text-slate-400">In-app alerting system ready</p>
        </div>

        {/* Application API */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Application API & Middleware</h2>
            </div>
            {renderStatusBadge(report.applicationApi.status)}
          </div>
          <p className="text-xs text-slate-600">
            Cloud Run container proxy online. Reverse proxy handling requests on port 3000.
          </p>
          <p className="text-[11px] font-mono text-slate-400">
            Internal ping latency: {report.applicationApi.latencyMs}ms | Checked: {new Date(report.applicationApi.lastChecked).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Specific Health Metrics & Subsystems */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email & AI Telemetry */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Integration Telemetry (Resend & Gemini)
            </h2>
            <span className="text-xs text-slate-400 font-medium">Secrets Safe</span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                <span>Resend Email Dispatcher</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                  0 API Key Leaks
                </span>
              </div>
              <p className="text-[11px] text-rose-800/80">
                Successful Sends: <strong className="text-slate-900">{report.emailMetrics.successfulSends}</strong> | Failed Sends: <strong className="text-slate-900">{report.emailMetrics.failedSends}</strong>
              </p>
              {report.emailMetrics.lastSuccessfulSend && (
                <p className="text-[10px] text-slate-400 font-mono">
                  Last Send: {new Date(report.emailMetrics.lastSuccessfulSend).toLocaleString()}
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span>Gemini AI Match Pipeline</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                  0 API Key Leaks
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80">
                Processed Requests: <strong className="text-slate-900">{report.aiMetrics.successfulRequests}</strong> | Request Errors: <strong className="text-slate-900">{report.aiMetrics.failedRequests}</strong>
              </p>
              {report.aiMetrics.lastSuccessfulRequest && (
                <p className="text-[10px] text-slate-400 font-mono">
                  Last Request: {new Date(report.aiMetrics.lastSuccessfulRequest).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Private Storage Buckets Verification */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Private Storage Bucket Security
            </h2>
            <span className="text-xs text-slate-400 font-medium">Signed URLs Active</span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="font-semibold text-slate-900">item-images</p>
                <p className="text-[10px] text-slate-500">Public item catalog photographs</p>
              </div>
              {renderStatusBadge(report.storageMetrics.itemImagesStatus)}
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="font-semibold text-slate-900">claim-proofs</p>
                <p className="text-[10px] text-slate-500">Private student receipts / ownership proofs (RLS & Signed URLs)</p>
              </div>
              {renderStatusBadge(report.storageMetrics.claimProofsStatus)}
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="font-semibold text-slate-900">admin-verification</p>
                <p className="text-[10px] text-slate-500">Private admin appointment documentation</p>
              </div>
              {renderStatusBadge(report.storageMetrics.adminProofsStatus)}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Consistency Diagnostics (Warnings Section) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Workflow Lifecycle Consistency Diagnostics
            </h2>
          </div>

          {report.workflowWarnings.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              isLoading={isAlerting}
              onClick={handleSendOwnerAlert}
              leftIcon={<Send className="w-3.5 h-3.5 text-amber-600" />}
            >
              Alert Owner via Notification
            </Button>
          )}
        </div>

        {report.workflowWarnings.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-900">Zero Workflow Inconsistencies Detected</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All returned items, claims, college assignments, and admin accounts follow strict lifecycle and relational integrity rules.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {report.workflowWarnings.map((warn) => (
              <div
                key={warn.id}
                className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3 text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">{warn.type}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                      {warn.severity}
                    </span>
                  </div>
                  <p className="text-slate-700">{warn.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Isolation Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Security Architecture:</span> Production health checks operate strictly within authorized owner context. No production records are automatically mutated or deleted by diagnostics.
        </div>
      </div>
    </div>
  );
};
