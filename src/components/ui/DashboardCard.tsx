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
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all ${
        isClickable ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm active:scale-[0.99]' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          {value !== undefined && (
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
          )}
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            {icon}
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3">
          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
