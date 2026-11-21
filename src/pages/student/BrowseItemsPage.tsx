import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Search,
  MapPin,
  PlusCircle,
  X,
  PackageOpen,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ItemCard } from '../../components/ui/ItemCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Item } from '../../types';

export const BrowseItemsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user, profile, configuredCollege } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  const [items, setItems] = useState<Item[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  const categoryOptions = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'ELECTRONICS', label: 'Electronics' },
    { value: 'ID_AND_CARDS', label: 'IDs & Wallets' },
    { value: 'KEYS', label: 'Keys' },
    { value: 'BAGS_AND_BACKPACKS', label: 'Bags & Backpacks' },
    { value: 'CLOTHING_AND_ACCESSORIES', label: 'Clothing' },
    { value: 'BOOKS_AND_STATIONERY', label: 'Books & Stationery' },
    { value: 'BOTTLES_AND_MUGS', label: 'Bottles' },
    { value: 'JEWELRY_AND_WATCHES', label: 'Jewelry & Watches' },
    { value: 'OTHER', label: 'Other' },
  ];

  const hasActiveFilters = Boolean(
    searchQuery || categoryFilter !== 'ALL' || locationFilter || dateFilter
  );

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setLocationFilter('');
    setDateFilter('');
  };

  useEffect(() => {
    let isMounted = true;

    async function loadItems() {
      setIsFetching(true);
      try {
        let rawItems: any[] = [];

        if (user && isSupabaseConfigured() && (profile?.college_id || configuredCollege?.id)) {
          const targetCollegeId = profile?.college_id || configuredCollege?.id;
          let query = supabase
            .from('items')
            .select('*')
            .eq('college_id', targetCollegeId)
            .in('type', ['found', 'FOUND'])
            .in('status', ['published', 'approved', 'PUBLISHED', 'APPROVED']);

          if (categoryFilter !== 'ALL') {
            query = query.eq('category', categoryFilter);
          }
          if (dateFilter) {
            query = query.eq('date', dateFilter);
          }

          const { data, error } = await query.order('created_at', { ascending: false });
          if (!error && data) {
            rawItems = data;
          }
        } else {
          const params = new URLSearchParams();
          if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
          if (dateFilter) params.set('date', dateFilter);

          const res = await fetch(`/api/public/items?${params.toString()}`);
          if (res.ok) {
            const payload = await res.json();
            rawItems = payload.items || [];
          }
        }

        if (isMounted) {
          let results = rawItems.map((d: any) => ({
            ...d,
            type: (d.type || 'FOUND').toUpperCase(),
            status: (d.status || 'PUBLISHED').toUpperCase(),
          })) as Item[];

          if (searchQuery.trim()) {
            const queryText = searchQuery.toLowerCase().trim();
            results = results.filter(
              (item) =>
                (item.item_name || '').toLowerCase().includes(queryText) ||
                (item.description || '').toLowerCase().includes(queryText) ||
                (item.brand || '').toLowerCase().includes(queryText) ||
                (item.color || '').toLowerCase().includes(queryText)
            );
          }

          if (locationFilter.trim()) {
            const locText = locationFilter.toLowerCase().trim();
            results = results.filter((item) => (item.location || '').toLowerCase().includes(locText));
          }

          setItems(results);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadItems();

    return () => {
      isMounted = false;
    };
  }, [user, profile?.college_id, configuredCollege?.id, categoryFilter, dateFilter, searchQuery, locationFilter]);

  return (
    <div className={`w-full space-y-5 ${!user ? 'max-w-[1160px] mx-auto px-4 sm:px-6 py-8' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-bold text-slate-900">Browse Items</h1>
          {!isFetching && (
            <span className="text-xs font-mono text-slate-400 tabular-nums">{items.length}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(user ? '/student/report-lost' : '/login')}
            leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          >
            Report Lost
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate(user ? '/student/report-found' : '/login')}
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            Report Found
          </Button>
        </div>
      </div>

      {/* Compact Filters */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="sm:col-span-2 lg:col-span-5">
            <Input
              placeholder="Search items, brand, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              rightIcon={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : undefined
              }
            />
          </div>

          <div className="lg:col-span-3">
            <Select
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categoryOptions}
            />
          </div>

          <div className="lg:col-span-2">
            <Input
              aria-label="Location"
              placeholder="Location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              leftIcon={<MapPin className="w-3.5 h-3.5" />}
            />
          </div>

          <div className="lg:col-span-2">
            <Input
              aria-label="Date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {isFetching ? (
        <LoadingState message="Loading items..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No items found"
          description={hasActiveFilters ? 'Try clearing or adjusting your filters.' : undefined}
          icon={<PackageOpen className="w-5 h-5 text-slate-400" />}
          actionLabel={hasActiveFilters ? 'Reset filters' : 'Report Found'}
          onAction={hasActiveFilters ? resetFilters : () => navigate(user ? '/student/report-found' : '/login')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onView={(id) => navigate(user ? `/student/item/${id}` : '/login')}
            />
          ))}
        </div>
      )}
    </div>
  );
};
