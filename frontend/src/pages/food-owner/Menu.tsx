import { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle2, XCircle, RefreshCw, Coffee, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { FoodItem } from '../../types';
import toast from 'react-hot-toast';

export default function FoodOwnerMenu() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/food/items', {
        params: {
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          search: search || undefined,
        },
      });
      setItems(res.data.data || []);
      setCategories(res.data.categories || []);
    } catch {
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, search]);

  const handleToggle = async (item: FoodItem) => {
    setTogglingId(item.id);
    try {
      const res = await api.patch(`/food/items/${item.id}/toggle`);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: res.data.data.isAvailable } : i))
      );
      toast.success(`${item.name} marked as ${res.data.data.isAvailable ? 'Available' : 'Out of Stock'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update item availability');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Menu & Availability
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Toggle food and beverage availability when items are prepared or run out of stock.
            </p>
          </div>
          <button
            onClick={fetchItems}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-auto transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Menu
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar flex-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items ({items.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <p className="text-slate-500 text-sm">No food items found matching your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const isToggling = togglingId === item.id;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between ${
                  item.isAvailable
                    ? 'border-slate-200/90'
                    : 'border-slate-200 bg-slate-50/70 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      ₹{item.price}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-2">{item.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {item.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold flex items-center gap-1.5 ${
                      item.isAvailable ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {item.isAvailable ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        In Stock
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                        Out of Stock
                      </>
                    )}
                  </span>

                  <button
                    disabled={isToggling}
                    onClick={() => handleToggle(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      item.isAvailable
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isToggling ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : item.isAvailable ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        Mark Unavailable
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Mark Available
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
