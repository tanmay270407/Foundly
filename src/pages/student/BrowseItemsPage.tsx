import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { 
  Search, 
  MapPin, 
  PlusCircle, 
  X,
  Building2,
  PackageOpen,
  Loader2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ItemCard } from '../../components/ui/ItemCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Item, ItemType } from '../../types';

export const BrowseItemsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ItemType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  const [items, setItems] = useState<Item[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  const categoryOptions = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'ELECTRONICS', label: 'Electronics & Gadgets' },
    { value: 'ID_AND_CARDS', label: 'Student IDs & Wallets' },
    { value: 'KEYS', label: 'Keys & Fobs' },
    { value: 'BAGS_AND_BACKPACKS', label: 'Bags & Backpacks' },
    { value: 'CLOTHING_AND_ACCESSORIES', label: 'Clothing & Jackets' },
    { value: 'BOOKS_AND_STATIONERY', label: 'Books & Stationery' },
    { value: 'BOTTLES_AND_MUGS', label: 'Bottles & Thermoses' },
    { value: 'JEWELRY_AND_WATCHES', label: 'Jewelry & Watches' },
    { value: 'OTHER', label: 'Other Items' },
  ];

  const hasActiveFilters = Boolean(
    searchQuery || typeFilter !== 'ALL' || categoryFilter !== 'ALL' || locationFilter || dateFilter
  );

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setCategoryFilter('ALL');
    setLocationFilter('');
    setDateFilter('');
  };

  useEffect(() => {
    let isMounted = true;

    async function loadItems() {
      if (!isSupabaseConfigured() || !profile?.college_id) {
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        // Query items for this student's college that are PUBLISHED or APPROVED
        let query = supabase
          .from('items')
          .select('*')
          .eq('college_id', profile.college_id)
          .in('status', ['published', 'approved', 'PUBLISHED', 'APPROVED']);

        if (typeFilter !== 'ALL') {
          query = query.eq('type', typeFilter.toLowerCase());
        }

        if (categoryFilter !== 'ALL') {
          query = query.eq('category', categoryFilter);
        }

        if (dateFilter) {
          query = query.eq('date', dateFilter);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (isMounted && !error && data) {
          // Normalize results into frontend expected case format if needed
          let results = data.map((d: any) => ({
            ...d,
            type: (d.type || 'LOST').toUpperCase(),
            status: (d.status || 'PENDING').toUpperCase(),
          })) as Item[];

          // Apply client-side text searches for location & item names
          if (searchQuery.trim()) {
            const queryText = searchQuery.toLowerCase().trim();
            results = results.filter(item => 
              item.item_name.toLowerCase().includes(queryText) ||
              item.description.toLowerCase().includes(queryText) ||
              (item.brand && item.brand.toLowerCase().includes(queryText)) ||
              (item.color && item.color.toLowerCase().includes(queryText))
            );
          }

          if (locationFilter.trim()) {
            const locText = locationFilter.toLowerCase().trim();
            results = results.filter(item => 
              item.location.toLowerCase().includes(locText)
            );
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
  }, [profile?.college_id, typeFilter, categoryFilter, dateFilter, searchQuery, locationFilter]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Browse Items</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filtering for items published in your college campus directory</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/student/report-found')}
          >
            Report Found
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/student/report-lost')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Report Lost
          </Button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        {/* Search Input */}
        <div className="w-full">
          <Input
            placeholder="Search by item name, brand, color, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            rightIcon={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* ISS-01: Mobile & Desktop Scrollable Category Chips */}
        <div className="w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none touch-pan-x -mx-1 px-1">
            {categoryOptions.map((cat) => {
              const isSelected = categoryFilter === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategoryFilter(cat.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all duration-150 border cursor-pointer select-none ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Lost / Found Toggle */}
          <div className="flex flex-col gap-1 text-left">
            <label className="text-xs font-medium text-slate-600">Item Type</label>
            <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                  typeFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('LOST')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                  typeFilter === 'LOST'
                    ? 'bg-white text-amber-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lost
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('FOUND')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                  typeFilter === 'FOUND'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Found
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={categoryOptions}
          />

          {/* Location Filter */}
          <Input
            label="Campus Location"
            placeholder="e.g. Library 2nd Floor, Gym..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            leftIcon={<MapPin className="w-3.5 h-3.5" />}
          />

          {/* Date Filter */}
          <Input
            label="Date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Active filters applied</span>
            <button
              onClick={resetFilters}
              className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Items Grid, Loader or Empty State */}
      <div>
        {isFetching ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium">Loading campus items directory...</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No items found"
            description={
              hasActiveFilters
                ? 'No items match your active search filters. Try adjusting your query or resetting filters.'
                : 'There are currently no approved lost or found items logged for your college campus.'
            }
            icon={<PackageOpen className="w-8 h-8 text-slate-400" />}
            actionLabel={hasActiveFilters ? 'Clear Filters' : 'Report an Item'}
            onAction={hasActiveFilters ? resetFilters : () => navigate('/student/report-lost')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onView={(id) => navigate(`/student/item/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
