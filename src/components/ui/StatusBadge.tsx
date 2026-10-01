import React from 'react';
import { ItemStatus, ClaimStatus, ItemType } from '../../types';

export interface StatusBadgeProps {
  status: ItemStatus | ClaimStatus | ItemType | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'LOST':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FOUND':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'APPROVED':
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'UNDER_REVIEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'HANDOVER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getLabel = () => {
    switch (normalized) {
      case 'UNDER_REVIEW':
        return 'Under Review';
      case 'HANDOVER':
        return 'Ready for Handover';
      default:
        return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    }
  };

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border whitespace-nowrap leading-none ${sizeClass} ${getStyle()}`}
    >
      {getLabel()}
    </span>
  );
};
