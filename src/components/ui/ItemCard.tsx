import React from 'react';
import { MapPin, Calendar, Tag, ArrowRight, Eye, ImageIcon } from 'lucide-react';
import { Item } from '../../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';

export interface ItemCardProps {
  item: Item;
  onView: (id: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onView }) => {
  return (
    <div
      id={`item-card-${item.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs hover:border-slate-300 hover:shadow-md transition-all"
    >
      {/* Image container prepared for Supabase storage image path */}
      <div className="relative aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {item.image_path ? (
          <img
            src={item.image_path}
            alt={item.item_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <ImageIcon className="w-8 h-8 stroke-1" />
            <span className="text-[11px] mt-1 text-slate-400 font-medium">No photo</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <StatusBadge status={item.type} size="sm" />
        </div>
        <div className="absolute top-3 right-3">
          <StatusBadge status={item.status} size="sm" />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium mb-1">
            <Tag className="w-3.5 h-3.5" />
            <span>{item.category.replace(/_/g, ' ')}</span>
          </div>
          <h4 className="text-base font-semibold text-slate-900 leading-snug line-clamp-1">
            {item.item_name}
          </h4>
          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
            {item.description}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{item.date}</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-1 justify-between"
          onClick={() => onView(item.id)}
          rightIcon={<ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />}
        >
          <span>View Details</span>
        </Button>
      </div>
    </div>
  );
};
