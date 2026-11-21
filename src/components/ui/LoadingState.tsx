import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-14 text-center ${className}`}>
      <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mb-2.5" />
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load',
  message = 'Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-10 px-6 text-center rounded-xl border border-rose-200/80 bg-rose-50/40 ${className}`}
    >
      <div className="w-10 h-10 rounded-lg bg-rose-100/80 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-rose-950">{title}</h4>
      <p className="text-xs text-rose-700/80 max-w-xs mt-1">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
