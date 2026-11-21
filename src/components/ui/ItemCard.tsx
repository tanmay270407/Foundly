import React from 'react';
import { MapPin, Calendar, ImageIcon, ArrowUpRight } from 'lucide-react';
import { Item } from '../../types';
import { StatusBadge } from './StatusBadge';

export interface ItemCardProps {
  item: Item;
  onView: (id: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onView }) => {
  const categoryLabel = item.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <article
      id={`item-card-${item.id}`}
      onClick={() => onView(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(item.id);
        }
      }}
      className="group flex flex-col rounded-xl border border-slate-200/80 bg-white overflow-hidden transition-all duration-150 hover:border-slate-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 cursor-pointer"
    >
      {/* Image preview */}
      <div className="relative aspect-[16/10] w-full bg-slate-100/80 flex items-center justify-center overflow-hidden">
        {item.image_path ? (
          <img
            src={item.image_path}
            alt={item.item_name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-300">
            <ImageIcon className="w-7 h-7 stroke-[1.5]" />
          </div>
        )}
        <div className="absolute top-2.5 right-2.5">
          <StatusBadge status={item.type} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-indigo-600 truncate">
              {categoryLabel}
            </span>
            {item.status !== 'PUBLISHED' && (
              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                {item.status === 'RETURNED' ? 'Returned' : item.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <h4 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {item.item_name}
          </h4>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{item.location}</span>
            </span>
            <span className="inline-flex items-center gap-1 shrink-0 text-slate-400 tabular-nums">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{item.date}</span>
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 shrink-0 transition-colors" />
        </div>
      </div>
    </article>
  );
};
