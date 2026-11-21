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
      case 'PENDING':
        return 'bg-amber-50/95 text-amber-700 border-amber-200/80';
      case 'FOUND':
      case 'PUBLISHED':
      case 'APPROVED':
      case 'COMPLETED':
      case 'RETURNED':
      case 'VERIFIED':
        return 'bg-emerald-50/95 text-emerald-700 border-emerald-200/80';
      case 'UNDER_REVIEW':
      case 'SUGGESTED':
        return 'bg-indigo-50/95 text-indigo-700 border-indigo-200/80';
      case 'HANDOVER':
      case 'CLAIMED':
        return 'bg-purple-50/95 text-purple-700 border-purple-200/80';
      case 'REJECTED':
      case 'DISMISSED':
      case 'NOT_A_MATCH':
        return 'bg-rose-50/95 text-rose-700 border-rose-200/80';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200/80';
    }
  };

  const getLabel = () => {
    switch (normalized) {
      case 'UNDER_REVIEW':
        return 'Under Review';
      case 'HANDOVER':
        return 'Handover';
      case 'NOT_A_MATCH':
        return 'Not a Match';
      case 'SUGGESTED':
        return 'Pending';
      case 'VERIFIED':
        return 'Reviewed';
      case 'CLAIMED':
        return 'Claimed';
      default:
        return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    }
  };

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border whitespace-nowrap leading-tight ${sizeClass} ${getStyle()}`}
    >
      {getLabel()}
    </span>
  );
};
