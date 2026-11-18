import { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  User,
  Coffee,
  Receipt,
  TrendingUp,
  RefreshCw,
  X,
  Clock,
} from 'lucide-react';
import api from '../../services/api';
import { FoodItem, FoodOrder, FoodMonthlyReportData, Department } from '../../types';
import toast from 'react-hot-toast';

export default function AdminFoodManagement() {
  const [activeTab, setActiveTab] = useState<'items' | 'orders' | 'reports'>('items');

  // ----------------------------------------------------
  // TAB 1: FOOD ITEMS MANAGEMENT
  // ----------------------------------------------------
  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [itemSearch, setItemSearch] = useState('');

  // Item Modal (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'Tea & Coffee',
    price: '',
    description: '',
    isAvailable: true,
  });
  const [savingItem, setSavingItem] = useState(false);

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await api.get('/food/items', {
        params: {
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          search: itemSearch || undefined,
        },
      });
      setItems(res.data.data || []);
      setCategories(res.data.categories || []);
    } catch {
      toast.error('Failed to load food items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      category: categories[0] || 'Tea & Coffee',
      price: '',
      description: '',
      isAvailable: true,
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: FoodItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      description: item.description || '',
      isAvailable: item.isAvailable,
    });
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.category || !itemForm.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(itemForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Price must be a valid positive number');
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        name: itemForm.name.trim(),
        category: itemForm.category.trim(),
        price: priceNum,
        description: itemForm.description.trim() || undefined,
        isAvailable: itemForm.isAvailable,
      };

      if (editingItem) {
        await api.put(`/food/items/${editingItem.id}`, payload);
        toast.success('Food item updated successfully');
      } else {
        await api.post('/food/items', payload);
        toast.success('Food item created successfully');
      }
      setModalOpen(false);
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save food item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: FoodItem) => {
    if (!confirm(`Are you sure you want to delete or disable "${item.name}"?`)) return;
    try {
      const res = await api.delete(`/food/items/${item.id}`);
      toast.success(res.data.message || 'Food item removed');
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete item');
    }
  };

  const handleToggleItem = async (item: FoodItem) => {
    try {
      const res = await api.patch(`/food/items/${item.id}/toggle`);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: res.data.data.isAvailable } : i))
      );
      toast.success(`${item.name} is now ${res.data.data.isAvailable ? 'Available' : 'Unavailable'}`);
    } catch {
      toast.error('Failed to toggle availability');
    }
  };

  // ----------------------------------------------------
  // TAB 2: ALL ORDERS
  // ----------------------------------------------------
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [orderDate, setOrderDate] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await api.get('/food/orders/all', {
        params: {
          search: orderSearch || undefined,
          status: orderStatus !== 'ALL' ? orderStatus : undefined,
          startDate: orderDate || undefined,
          endDate: orderDate || undefined,
          departmentId: selectedDept || undefined,
          limit: 50,
        },
      });
      setOrders(res.data.data || []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  // ----------------------------------------------------
  // TAB 3: MONTHLY REPORTS & EXPORTS
  // ----------------------------------------------------
  const now = new Date();
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [reportDept, setReportDept] = useState('');
  const [reportData, setReportData] = useState<FoodMonthlyReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchReport = async () => {
    try {
      setLoadingReport(true);
      const res = await api.get('/food/reports/monthly', {
        params: {
          year: reportYear,
          month: reportMonth,
          departmentId: reportDept || undefined,
        },
      });
      setReportData(res.data.data || null);
    } catch {
      toast.error('Failed to fetch monthly report');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloadingExcel(true);
      const res = await api.get('/food/reports/export/excel', {
        params: {
          year: reportYear,
          month: reportMonth,
          departmentId: reportDept || undefined,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Food_Expense_Report_${reportYear}_${reportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel report downloaded successfully');
    } catch {
      toast.error('Failed to download Excel report');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await api.get('/food/reports/export/pdf', {
        params: {
          year: reportYear,
          month: reportMonth,
          departmentId: reportDept || undefined,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Food_Expense_Report_${reportYear}_${reportMonth}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF report downloaded successfully');
    } catch {
      toast.error('Failed to download PDF report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Fetch departments for dropdown
  useEffect(() => {
    api.get('/departments')
      .then((res) => setDepartments(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'items') {
      fetchItems();
    } else if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'reports') {
      fetchReport();
    }
  }, [activeTab, selectedCategory, itemSearch, orderStatus, orderDate, selectedDept, reportYear, reportMonth, reportDept]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Food Ordering Management
                </h1>
                <p className="text-slate-500 text-sm">
                  Manage food items, monitor company-wide food orders, and download monthly expense reports.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'items'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coffee className="w-4 h-4" />
              <span>Food Items</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>All Orders</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'reports'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Monthly Expense Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MANAGE FOOD ITEMS                                 */}
      {/* ======================================================== */}
      {activeTab === 'items' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar flex-1">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Categories ({items.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Food Item</span>
              </button>
            </div>
          </div>

          {/* Food Items Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loadingItems ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-primary-500" />
                        Loading food items...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No food items found. Click "Add Food Item" to add one.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-200/60">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">
                          ₹{item.price}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleItem(item)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                              item.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                item.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            ></span>
                            <span>{item.isAvailable ? 'In Stock' : 'Out of Stock'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit item"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              title="Delete item"
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit Item Modal */}
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingItem ? 'Edit Food Item' : 'Add New Food Item'}
                  </h3>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveItem} className="space-y-4 mt-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Item Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Masala Chai, Veg Samosa..."
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        list="category-suggestions"
                        placeholder="e.g. Tea & Coffee"
                        value={itemForm.category}
                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                      <datalist id="category-suggestions">
                        <option value="Tea & Coffee" />
                        <option value="Milk" />
                        <option value="Snacks" />
                        <option value="Bakery" />
                        <option value="Beverages" />
                      </datalist>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Price (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        required
                        placeholder="25"
                        value={itemForm.price}
                        onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ingredients or details..."
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isAvailableCheckbox"
                      checked={itemForm.isAvailable}
                      onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <label htmlFor="isAvailableCheckbox" className="font-semibold text-slate-700">
                      Available for Ordering Immediately
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingItem}
                      className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm"
                    >
                      {savingItem ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>{editingItem ? 'Save Changes' : 'Create Item'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ALL ORDERS TABLE                                  */}
      {/* ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Order #, Employee ID, Name..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="READY">Ready</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
                />
                {orderDate && (
                  <button
                    onClick={() => setOrderDate('')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Break Time Slot</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-primary-500" />
                        Loading orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No food orders match your filters.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {o.orderNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          <div>
                            {(o as any).orderDate || new Date(o.createdAt).toLocaleDateString('en-GB')}{' '}
                            {(o as any).orderTime || new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                          {(o as any).readyTime && (
                            <div className="text-[10px] text-emerald-600 font-medium">
                              Ready: {(o as any).readyTime}
                            </div>
                          )}
                          {o.status === 'DELIVERED' && ((o as any).deliveryTime || (o as any).deliveryDateTime) ? (
                            <div className="text-[10px] text-blue-600 font-medium">
                              Delivered: {(o as any).deliveryTime || (o as any).deliveryDateTime}
                            </div>
                          ) : o.status === 'READY' ? (
                            <div className="text-[10px] text-amber-600 font-medium">
                              Delivery: Pending
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{o.employee?.name}</span>
                          <span className="font-mono text-[11px] text-primary-600">
                            {o.employee?.employeeId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {o.employee?.department?.name || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                            {o.breakTime}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                          {o.items.map((i) => `${i.itemName} (x${i.quantity})`).join(', ')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              o.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.status === 'READY'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : o.status === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          ₹{o.totalAmount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MONTHLY REPORTS & EXPORTS                         */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Controls & Export Buttons */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Month
                  </label>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(Number(e.target.value))}
                    className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December',
                    ].map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Year
                  </label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
                  >
                    {[2024, 2025, 2026, 2027].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Department
                  </label>
                  <select
                    value={reportDept}
                    onChange={(e) => setReportDept(e.target.value)}
                    className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="flex items-center gap-2.5 pt-2 lg:pt-0">
                <button
                  disabled={downloadingExcel}
                  onClick={handleDownloadExcel}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{downloadingExcel ? 'Generating Excel...' : 'Download Excel Report'}</span>
                </button>

                <button
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
                </button>
              </div>
            </div>

            {/* Monthly Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Food Expenditure
                </span>
                <p className="text-2xl font-extrabold text-primary-600 mt-1">
                  ₹{(reportData?.totalSpend || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Orders Placed
                </span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {reportData?.totalOrders || 0}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Employees
                </span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {reportData?.uniqueEmployeesCount || 0}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Average Order Value
                </span>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">
                  ₹{reportData?.avgOrderValue || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Department Breakdown Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Department Expense Summary
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Department Name</th>
                    <th className="py-3 px-4">Orders Count</th>
                    <th className="py-3 px-4">Total Amount (₹)</th>
                    <th className="py-3 px-4 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {(!reportData?.departmentSummary || reportData.departmentSummary.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No department expense records for this month.
                      </td>
                    </tr>
                  ) : (
                    reportData.departmentSummary.map((d) => {
                      const share = reportData.totalSpend > 0 ? ((d.totalAmount / reportData.totalSpend) * 100).toFixed(1) : '0';
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-bold text-slate-900">{d.name}</td>
                          <td className="py-3 px-4 text-slate-600">{d.totalOrders}</td>
                          <td className="py-3 px-4 font-extrabold text-slate-900">
                            ₹{d.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-primary-600">
                            {share}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee-wise Expense Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Employee-Wise Monthly Food Expenses
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Orders Placed</th>
                    <th className="py-3 px-4 text-right">Total Food Expenses (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {(!reportData?.employeeSummary || reportData.employeeSummary.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No employee expenses recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    reportData.employeeSummary.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-primary-600">
                          {emp.empId}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{emp.name}</td>
                        <td className="py-3 px-4 text-slate-600">{emp.department}</td>
                        <td className="py-3 px-4 text-slate-600">{emp.totalOrders}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          ₹{emp.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
