import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Loader2, TrendingUp, TrendingDown, Wallet, Receipt, ShoppingBag,
  Users, UtensilsCrossed, Package, Calendar, Filter, Download
} from 'lucide-react';

type Branch = { id: string; name: string };

type OrderRow = {
  id: string;
  order_number: string;
  total_amount: number;
  order_type: string;
  status: string;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  product_id: string;
  quantity: number;
  line_total: number;
  products?: { name: string } | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  category_id: string | null;
  expense_categories?: { name: string; color: string } | null;
};

export function ReportsPage() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(profile?.default_branch_id || '');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalExpenses: 0,
    netProfit: 0,
    dineInOrders: 0,
    takeawayOrders: 0,
    deliveryOrders: 0,
  });

  const [topProducts, setTopProducts] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<Array<{ name: string; color: string; total: number }>>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: brs } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
      const branchesData = (brs as Branch[]) || [];
      setBranches(branchesData);
      if (!branchId && branchesData.length > 0) setBranchId(branchesData[0].id);
    })();
  }, []);

  const getDateFilter = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo.toISOString();
      default:
        return null;
    }
  }, [dateRange]);

  const fetchReports = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);

    const dateFilter = getDateFilter();
    let orderQuery = supabase.from('orders').select('id, order_number, total_amount, order_type, status, created_at').eq('branch_id', branchId);
    if (dateFilter) orderQuery = orderQuery.gte('created_at', dateFilter);
    const { data: orders } = await orderQuery.order('created_at', { ascending: false });

    let expenseQuery = supabase.from('expenses').select('id, amount, category_id, expense_categories!expenses_category_id_fkey ( name, color )').eq('branch_id', branchId);
    if (dateFilter) expenseQuery = expenseQuery.gte('expense_date', dateFilter);
    const { data: expenses } = await expenseQuery;

    const orderList = (orders as OrderRow[]) || [];
    const expenseList = ((expenses as unknown) as ExpenseRow[]) || [];

    const paidOrders = orderList.filter(o => o.status === 'paid' || o.status === 'served');
    const totalSales = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);
    const totalOrders = paidOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const totalExpenses = expenseList.reduce((s, e) => s + Number(e.amount), 0);

    setStats({
      totalSales,
      totalOrders,
      avgOrderValue,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      dineInOrders: paidOrders.filter(o => o.order_type === 'dine_in').length,
      takeawayOrders: paidOrders.filter(o => o.order_type === 'takeaway').length,
      deliveryOrders: paidOrders.filter(o => o.order_type === 'delivery').length,
    });

    // Top products
    if (paidOrders.length > 0) {
      const orderIds = paidOrders.map(o => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, line_total, products!order_items_product_id_fkey ( name )')
        .in('order_id', orderIds);
      const itemList = ((items as unknown) as OrderItemRow[]) || [];
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      itemList.forEach(item => {
        const name = item.products?.name || 'نامشخص';
        const existing = productMap.get(name);
        if (existing) {
          existing.quantity += Number(item.quantity);
          existing.revenue += Number(item.line_total);
        } else {
          productMap.set(name, { quantity: Number(item.quantity), revenue: Number(item.line_total) });
        }
      });
      setTopProducts(Array.from(productMap.entries())
        .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10));
    } else {
      setTopProducts([]);
    }

    // Expense by category
    const catMap = new Map<string, { color: string; total: number }>();
    expenseList.forEach(e => {
      const catName = e.expense_categories?.name || 'بدون دسته';
      const catColor = e.expense_categories?.color || '#6b7280';
      const existing = catMap.get(catName);
      if (existing) existing.total += Number(e.amount);
      else catMap.set(catName, { color: catColor, total: Number(e.amount) });
    });
    setExpenseByCategory(Array.from(catMap.entries())
      .map(([name, v]) => ({ name, color: v.color, total: v.total }))
      .sort((a, b) => b.total - a.total));

    setRecentOrders(orderList.slice(0, 10));
    setLoading(false);
  }, [branchId, getDateFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const dateRangeLabels: Record<string, string> = {
    today: 'امروز',
    week: '۷ روز اخیر',
    month: '۳۰ روز اخیر',
    all: 'همه',
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {(Object.keys(dateRangeLabels) as string[]).map(key => (
            <button key={key} onClick={() => setDateRange(key as typeof dateRange)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === key ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {dateRangeLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={TrendingUp} label="فروش کل" value={Math.round(stats.totalSales).toLocaleString('fa-IR') + ' ت'} color="#10b981" bg="bg-emerald-50" />
            <KPICard icon={ShoppingBag} label="تعداد سفارش‌ها" value={stats.totalOrders.toLocaleString('fa-IR')} color="#3b82f6" bg="bg-blue-50" />
            <KPICard icon={Receipt} label="میانگین سفارش" value={Math.round(stats.avgOrderValue).toLocaleString('fa-IR') + ' ت'} color="#f59e0b" bg="bg-amber-50" />
            <KPICard icon={Wallet} label="سود خالص" value={Math.round(stats.netProfit).toLocaleString('fa-IR') + ' ت'} color={stats.netProfit >= 0 ? '#10b981' : '#ef4444'} bg={stats.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Order Type Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <UtensilsCrossed className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-800 text-sm">تفکیک نوع سفارش</h3>
              </div>
              {stats.totalOrders === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">سفارشی در این بازه نیست</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'سالن', value: stats.dineInOrders, color: 'bg-blue-500' },
                    { label: 'بیرون‌بر', value: stats.takeawayOrders, color: 'bg-amber-500' },
                    { label: 'ارسال', value: stats.deliveryOrders, color: 'bg-emerald-500' },
                  ].map(item => {
                    const percent = stats.totalOrders > 0 ? (item.value / stats.totalOrders) * 100 : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">{item.label}</span>
                          <span className="text-sm font-bold text-gray-800">{item.value.toLocaleString('fa-IR')} ({Math.round(percent)}%)</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${item.color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expense Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-gray-800 text-sm">هزینه‌ها بر اساس دسته</h3>
              </div>
              {expenseByCategory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">هزینه‌ای در این بازه نیست</p>
              ) : (
                <div className="space-y-3">
                  {expenseByCategory.map(cat => {
                    const maxTotal = Math.max(...expenseByCategory.map(c => c.total));
                    const widthPercent = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: cat.color }} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-600">{cat.name}</span>
                            <span className="text-sm font-bold text-gray-800" dir="ltr">{Math.round(cat.total).toLocaleString('fa-IR')} ت</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${widthPercent}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-800 text-sm">پرفروش‌ترین محصولات</h3>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">داده‌ای موجود نیست</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-gray-400 text-xs">
                      <th className="text-right font-medium px-4 py-2">#</th>
                      <th className="text-right font-medium px-4 py-2">محصول</th>
                      <th className="text-right font-medium px-4 py-2">تعداد فروش</th>
                      <th className="text-right font-medium px-4 py-2">درآمد</th>
                      <th className="text-right font-medium px-4 py-2">سهم درآمد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, idx) => {
                      const totalRevenue = topProducts.reduce((s, x) => s + x.revenue, 0);
                      const percent = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
                      return (
                        <tr key={p.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-gray-400 font-bold">{(idx + 1).toLocaleString('fa-IR')}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-700">{p.name}</td>
                          <td className="px-4 py-2.5 text-gray-600" dir="ltr">{p.quantity.toLocaleString('fa-IR')}</td>
                          <td className="px-4 py-2.5 text-gray-800 font-bold" dir="ltr">{Math.round(p.revenue).toLocaleString('fa-IR')} ت</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                                <div className="h-full bg-gradient-to-l from-amber-500 to-orange-500 rounded-full" style={{ width: `${percent}%` }} />
                              </div>
                              <span className="text-xs text-gray-400">{Math.round(percent)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-800 text-sm">سفارش‌های اخیر</h3>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">سفارشی ثبت نشده است</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map(o => {
                  const orderTypeLabels: Record<string, string> = { dine_in: 'سالن', takeaway: 'بیرون‌بر', delivery: 'ارسال' };
                  const statusLabels: Record<string, string> = { paid: 'پرداخت شده', served: 'سرو شده', open: 'باز', sent: 'ارسال شده', preparing: 'در حال پخت', ready: 'آماده', cancelled: 'لغو شده' };
                  return (
                    <div key={o.id} className="flex items-center justify-between bg-gray-50/50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700" dir="ltr">{o.order_number}</p>
                          <p className="text-xs text-gray-400">{orderTypeLabels[o.order_type] || o.order_type} — {new Date(o.created_at).toLocaleDateString('fa-IR')} {new Date(o.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700" dir="ltr">{Number(o.total_amount).toLocaleString('fa-IR')} ت</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${o.status === 'paid' || o.status === 'served' ? 'bg-emerald-50 text-emerald-600' : o.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                          {statusLabels[o.status] || o.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color, bg }: { icon: typeof TrendingUp; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-800" dir="ltr">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
