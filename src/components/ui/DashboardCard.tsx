import React from 'react';

export interface DashboardCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  onClick,
  className = '',
  children,
  id,
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      id={id}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`rounded-xl border border-slate-200/80 bg-white p-4 transition-all duration-150 ${
        isClickable
          ? 'cursor-pointer hover:border-slate-300 hover:bg-slate-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40'
          : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate">{title}</p>
          {value !== undefined && (
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight tabular-nums leading-none">
              {value}
            </p>
          )}
          {subtitle && <p className="text-xs text-slate-400 mt-1.5 truncate">{subtitle}</p>}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
            {icon}
          </div>
        )}
      </div>
      {badge && (
        <p className="text-[11px] font-medium text-slate-400 mt-2.5 truncate">{badge}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
};
