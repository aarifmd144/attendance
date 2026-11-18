import { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ChefHat,
  Search,
  ArrowRight,
  TrendingUp,
  Receipt,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { FoodItem, FoodOrder, FoodExpensesData, FoodOrderStatus } from '../../types';
import toast from 'react-hot-toast';

const BREAK_TIMES = [
  'Morning Tea Break (10:30 AM - 11:00 AM)',
  'Lunch Break (01:00 PM - 02:00 PM)',
  'Evening Refreshment (04:30 PM - 05:00 PM)',
  'Immediate / Current Break',
];

interface CartItem {
  item: FoodItem;
  quantity: number;
}

export default function EmployeeFoodOrdering() {
  const { user } = useAuthStore();
  const employee = user?.employee;

  const [activeTab, setActiveTab] = useState<'menu' | 'my-orders' | 'expenses'>('menu');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loadingItems, setLoadingItems] = useState(true);

  // Cart State
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [selectedBreakTime, setSelectedBreakTime] = useState(BREAK_TIMES[0]);
  const [customBreakTime, setCustomBreakTime] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // My Orders State
  const [myOrders, setMyOrders] = useState<FoodOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Expenses State
  const [expenses, setExpenses] = useState<FoodExpensesData | null>(null);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  // Fetch Menu Items
  const fetchMenu = async () => {
    try {
      setLoadingItems(true);
      const res = await api.get('/food/items', {
        params: {
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          search: search || undefined,
        },
      });
      setItems(res.data.data || []);
      setCategories(res.data.categories || []);
    } catch {
      toast.error('Failed to load food menu');
    } finally {
      setLoadingItems(false);
    }
  };

  // Fetch My Orders
  const fetchMyOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await api.get('/food/orders/my-orders');
      setMyOrders(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch Expenses
  const fetchExpenses = async () => {
    try {
      setLoadingExpenses(true);
      const res = await api.get('/food/orders/my-expenses');
      setExpenses(res.data.data || null);
    } catch {
      // silent
    } finally {
      setLoadingExpenses(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [selectedCategory, search]);

  useEffect(() => {
    if (activeTab === 'my-orders') {
      fetchMyOrders();
      const interval = setInterval(fetchMyOrders, 8000);
      return () => clearInterval(interval);
    } else if (activeTab === 'expenses') {
      fetchExpenses();
    }
  }, [activeTab]);

  // Cart operations
  const updateQuantity = (item: FoodItem, delta: number) => {
    setCart((prev) => {
      const updated = new Map(prev);
      const current = updated.get(item.id);
      const newQty = (current ? current.quantity : 0) + delta;

      if (newQty <= 0) {
        updated.delete(item.id);
      } else {
        updated.set(item.id, { item, quantity: newQty });
      }
      return updated;
    });
  };

  const clearCart = () => setCart(new Map());

  const cartList = Array.from(cart.values());
  const cartTotal = cartList.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);

  // Place Order
  const handlePlaceOrder = async () => {
    if (cartList.length === 0) {
      toast.error('Your cart is empty. Please add items before placing order.');
      return;
    }

    const breakTime =
      selectedBreakTime === 'Custom' ? customBreakTime.trim() : selectedBreakTime;
    if (!breakTime) {
      toast.error('Please specify a break time for your order.');
      return;
    }

    setPlacingOrder(true);
    try {
      const payload = {
        breakTime,
        notes: orderNotes.trim() || undefined,
        items: cartList.map((ci) => ({
          foodItemId: ci.item.id,
          quantity: ci.quantity,
        })),
      };

      const res = await api.post('/food/orders', payload);
      toast.success('Food order placed successfully!');
      clearCart();
      setOrderNotes('');
      // Switch to my-orders to track real-time status
      setActiveTab('my-orders');
      fetchMyOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Order Stepper Helper
  const renderOrderStatusStepper = (status: FoodOrderStatus) => {
    const steps = [
      { key: 'PENDING', label: 'Order Placed' },
      { key: 'ACCEPTED', label: 'Accepted' },
      { key: 'PREPARING', label: 'Preparing' },
      { key: 'READY', label: 'Ready for Pickup' },
      { key: 'DELIVERED', label: 'Delivered' },
    ];

    if (status === 'CANCELLED') {
      return (
        <div className="py-2 px-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>This order was cancelled.</span>
        </div>
      );
    }

    const currentIndex = steps.findIndex((s) => s.key === status);

    return (
      <div className="w-full py-2">
        <div className="grid grid-cols-5 gap-1 items-center">
          {steps.map((step, idx) => {
            const isCompleted = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isCurrent
                      ? 'bg-amber-500 text-white ring-4 ring-amber-500/20 animate-pulse'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted && !isCurrent ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 font-semibold leading-tight ${
                    isCurrent
                      ? 'text-amber-700 font-bold'
                      : isCompleted
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Employee Welcome & Navigation Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold">
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Food & Refreshments
                </h1>
                <p className="text-slate-500 text-sm">
                  Order tea, coffee, milk, snacks, bakery items & track your expenses.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'menu'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Order Food</span>
              {cartList.length > 0 && (
                <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {cartList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('my-orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'my-orders'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>My Orders</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'expenses'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>My Expenses</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ORDER FOOD MENU & CART                            */}
      {/* ======================================================== */}
      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left 2 Cols: Menu Selection */}
          <div className="lg:col-span-2 space-y-5">
            {/* Category Filter and Search */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                {/* Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === 'ALL'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Items
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

                {/* Search Input */}
                <div className="relative sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tea, snacks, etc."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Food Cards Grid */}
            {loadingItems ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading delicious menu...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-500 text-sm">No items found in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((item) => {
                  const inCart = cart.get(item.id);
                  const qty = inCart?.quantity || 0;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between ${
                        item.isAvailable
                          ? 'border-slate-200/90 hover:border-amber-400/60 hover:shadow-md'
                          : 'border-slate-200 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60">
                            {item.category}
                          </span>
                          <span className="text-base font-extrabold text-slate-900">
                            ₹{item.price}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-base mt-2">{item.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {item.description || 'Freshly prepared for your break time.'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        {!item.isAvailable ? (
                          <span className="text-xs font-semibold text-rose-500">
                            Currently Out of Stock
                          </span>
                        ) : qty === 0 ? (
                          <button
                            onClick={() => updateQuantity(item, 1)}
                            className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Tray
                          </button>
                        ) : (
                          <div className="w-full flex items-center justify-between bg-amber-50/70 border border-amber-200/80 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(item, -1)}
                              className="w-8 h-8 rounded-lg bg-white shadow-xs text-amber-800 flex items-center justify-center hover:bg-amber-100 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-extrabold text-xs text-amber-900 px-2">
                              {qty} in Tray (₹{qty * item.price})
                            </span>
                            <button
                              onClick={() => updateQuantity(item, 1)}
                              className="w-8 h-8 rounded-lg bg-white shadow-xs text-amber-800 flex items-center justify-center hover:bg-amber-100 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Col: Sticky Tray / Checkout Drawer */}
          <div className="sticky top-20 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-slate-900 text-base">Your Food Tray</h2>
              </div>
              {cartList.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {cartList.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Coffee className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-medium">Your tray is empty.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "+ Add to Tray" on any tea, snack, or bakery item to start your order.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart Items List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {cartList.map(({ item, quantity }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400">
                          ₹{item.price} each × {quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item, -1)}
                            className="p-1 hover:text-rose-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-bold text-slate-800">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item, 1)}
                            className="p-1 hover:text-emerald-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-extrabold text-slate-900 w-12 text-right">
                          ₹{item.price * quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Break Time Selector */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Select Break Time
                  </label>
                  <select
                    value={selectedBreakTime}
                    onChange={(e) => setSelectedBreakTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {BREAK_TIMES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                    <option value="Custom">Custom Break Time...</option>
                  </select>

                  {selectedBreakTime === 'Custom' && (
                    <input
                      type="text"
                      placeholder="e.g. 03:15 PM Tea Break"
                      value={customBreakTime}
                      onChange={(e) => setCustomBreakTime(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  )}
                </div>

                {/* Special Instructions */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    Special Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Less sugar, hot tea, no onion..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>

                {/* Total & Place Order Button */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Order Total:</span>
                    <span className="text-xl font-extrabold text-slate-900">
                      ₹{cartTotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-[11px] leading-tight">
                    Order will be linked to your Employee ID: <strong>{employee?.employeeId}</strong> ({employee?.name}).
                  </div>

                  <button
                    disabled={placingOrder}
                    onClick={handlePlaceOrder}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    {placingOrder ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Place Food Order (₹{cartTotal})
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MY ORDERS & LIVE TRACKING STATUS                  */}
      {/* ======================================================== */}
      {activeTab === 'my-orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Your Food Orders & Status
            </h2>
            <button
              onClick={fetchMyOrders}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingOrders && myOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading your orders...</p>
            </div>
          ) : myOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Orders Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                You haven't placed any food orders yet today.
              </p>
              <button
                onClick={() => setActiveTab('menu')}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Browse Menu & Order Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => {
                const isReady = order.status === 'READY';
                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                      isReady
                        ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20'
                        : 'border-slate-200/90'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                              order.status === 'READY'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                                : order.status === 'PREPARING'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : order.status === 'ACCEPTED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : order.status === 'DELIVERED'
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                          <span>
                            Order Time:{' '}
                            <strong className="text-slate-700">
                              {(order as any).orderTime ||
                                new Date(order.createdAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                            </strong>{' '}
                            ({(order as any).orderDate || new Date(order.createdAt).toLocaleDateString('en-GB')})
                          </span>

                          {(order as any).readyTime && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                              Ready: <strong>{(order as any).readyTime}</strong>
                            </span>
                          )}

                          {order.status === 'DELIVERED' ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                              Delivered:{' '}
                              <strong>
                                {(order as any).deliveryTime ||
                                  (order as any).deliveryDateTime ||
                                  'Delivered'}
                              </strong>
                            </span>
                          ) : order.status === 'READY' ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                              Delivery: <strong>Delivery Pending</strong>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                          title="Scheduled Break Time"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Scheduled Break: {order.breakTime}</span>
                        </span>
                        <span className="text-lg font-extrabold text-slate-900">
                          ₹{order.totalAmount}
                        </span>
                      </div>
                    </div>

                    {/* Stepper Progress */}
                    <div className="py-4 border-b border-slate-100">
                      {renderOrderStatusStepper(order.status)}
                    </div>

                    {/* Items List */}
                    <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/50"
                        >
                          <span className="text-slate-800 font-medium">
                            {item.itemName} × {item.quantity}
                          </span>
                          <span className="font-bold text-slate-900">₹{item.subtotal}</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <p className="mt-2 text-xs text-amber-800 bg-amber-50/70 p-2 rounded-lg">
                        <strong>Note:</strong> {order.notes}
                      </p>
                    )}

                    {isReady && (
                      <div className="mt-4 p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-white" />
                          <span>Your order is ready! Please pick it up from the canteen.</span>
                        </div>
                        <span className="px-2 py-0.5 bg-white/20 rounded text-[11px]">
                          Pickup Ready
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: DAILY & MONTHLY EXPENSES                          */}
      {/* ======================================================== */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Today's Food Expense
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Coffee className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                ₹{expenses?.todayTotal || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Orders placed today</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  This Month Total
                </span>
                <span className="p-2 rounded-xl bg-primary-50 text-primary-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-primary-600 mt-2">
                ₹{expenses?.monthTotal || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Linked to {employee?.employeeId} ({employee?.name})
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Orders This Month
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {expenses?.totalOrdersThisMonth || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Total refreshment orders</p>
            </div>
          </div>

          {/* Daily Trend Table / Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">
              Daily Expense Breakdown (Current Month)
            </h3>

            {(!expenses?.dailyBreakdown || expenses.dailyBreakdown.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No food orders placed yet this month.
              </p>
            ) : (
              <div className="space-y-2">
                {expenses.dailyBreakdown.map((item) => (
                  <div
                    key={item.date}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-800">{item.day}</span>
                      <span className="text-[11px] text-slate-400">
                        ({item.ordersCount} order{item.ordersCount > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900">
                      ₹{item.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category-wise Breakdown */}
          {expenses?.categoryBreakdown && expenses.categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-4">
                Spend by Category
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {expenses.categoryBreakdown.map((cat) => (
                  <div
                    key={cat.category}
                    className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl"
                  >
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      {cat.category}
                    </span>
                    <p className="text-lg font-bold text-slate-900 mt-1">₹{cat.amount}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
