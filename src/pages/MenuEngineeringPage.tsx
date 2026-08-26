import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Brain, TrendingUp, TrendingDown, DollarSign, Package,
  Loader2, Download, Lightbulb, Target, Percent,
  ArrowUp, ArrowDown, Trash2, AlertCircle
} from 'lucide-react';

type Product = {
  id: string;
  name: string;
  sale_price: number;
  purchase_price: number;
  packaging_cost: number;
  is_active: boolean;
  product_categories?: { name: string } | null;
};

type OrderItem = {
  quantity: number;
  line_total: number;
  product_id: string;
  products?: { name: string } | null;
};

type RecipeVersion = {
  calculated_cost_per_serving: number | null;
  product_id: string;
};

export function MenuEngineeringPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [recipeCosts, setRecipeCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: items }, { data: recipes }] = await Promise.all([
      supabase.from('products')
        .select(`id, name, sale_price, purchase_price, packaging_cost, is_active, product_categories ( name )`)
        .in('product_type', ['finished', 'semi_finished'])
        .order('name'),
      supabase.from('order_items')
        .select('quantity, line_total, product_id, products!order_items_product_id_fkey ( name )')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('recipes')
        .select(`product_id, recipe_versions!recipes_id_fkey ( calculated_cost_per_serving )`),
    ]);

    setProducts((prods as Product[]) || []);
    setOrderItems((items as OrderItem[]) || []);

    const costMap: Record<string, number> = {};
    (recipes as any[] || []).forEach(r => {
      const versions = r.recipe_versions as any[];
      if (versions && versions.length > 0) {
        const active = versions.find(v => v.calculated_cost_per_serving != null);
        if (active) costMap[r.product_id] = Number(active.calculated_cost_per_serving);
      }
    });
    setRecipeCosts(costMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const productAnalysis = products.map(p => {
    const items = orderItems.filter(i => i.product_id === p.id);
    const totalSold = items.reduce((s, i) => s + Number(i.quantity), 0);
    const totalRevenue = items.reduce((s, i) => s + Number(i.line_total), 0);
    const cost = recipeCosts[p.id] || Number(p.purchase_price) || 0;
    const totalCost = cost * totalSold;
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const foodCostPercent = Number(p.sale_price) > 0 ? (cost / Number(p.sale_price)) * 100 : 0;
    return {
      ...p,
      totalSold,
      totalRevenue,
      totalCost,
      profit,
      margin,
      foodCostPercent,
      cost,
    };
  });

  const maxRevenue = Math.max(...productAnalysis.map(p => p.totalRevenue), 1);
  const avgRevenue = productAnalysis.reduce((s, p) => s + p.totalRevenue, 0) / (productAnalysis.length || 1);

  const matrix = productAnalysis.map(p => {
    const isHighSales = p.totalRevenue > avgRevenue;
    const isHighMargin = p.margin > 50;
    let category = '';
    if (isHighSales && isHighMargin) category = 'star';
    else if (isHighSales && !isHighMargin) category = 'workhorse';
    else if (!isHighSales && isHighMargin) category = 'puzzle';
    else category = 'dog';
    return { ...p, category };
  });

  const totalRevenue = productAnalysis.reduce((s, p) => s + p.totalRevenue, 0);
  const totalProfit = productAnalysis.reduce((s, p) => s + p.profit, 0);
  const totalCost = productAnalysis.reduce((s, p) => s + p.totalCost, 0);

  const exportAnalysis = () => {
    const headers = ['محصول', 'دسته', 'فروش تعداد', 'درآمد', 'هزینه', 'سود', 'حاشیه سود %', 'هزینه غذا %', 'دسته‌بندی'];
    const rows = matrix.map(p => [
      p.name,
      p.product_categories?.name || '',
      p.totalSold,
      Math.round(p.totalRevenue),
      Math.round(p.totalCost),
      Math.round(p.profit),
      Math.round(p.margin),
      Math.round(p.foodCostPercent),
      categoryLabels[p.category],
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu-engineering.csv';
    a.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="درآمد کل (۳۰ روز)" value={Math.round(totalRevenue).toLocaleString('fa-IR') + ' ت'} color="#10b981" bg="bg-emerald-50" />
        <StatCard icon={TrendingDown} label="هزینه کل" value={Math.round(totalCost).toLocaleString('fa-IR') + ' ت'} color="#ef4444" bg="bg-red-50" />
        <StatCard icon={TrendingUp} label="سود کل" value={Math.round(totalProfit).toLocaleString('fa-IR') + ' ت'} color="#f59e0b" bg="bg-amber-50" />
        <StatCard icon={Percent} label="حاشیه سود" value={totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) + '٪' : '—'} color="#3b82f6" bg="bg-blue-50" />
      </div>

      {/* AI Recommendations */}
      <div className="bg-gradient-to-l from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-gray-800 text-sm">پیشنهادهای هوشمند</h3>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {matrix.filter(p => p.category === 'star').length > 0 && (
            <p className="flex items-start gap-2"><Target className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              محصولات ستاره (سود بالا و فروش بالا) را در معرض نمایش بیشتری قرار دهید: {matrix.filter(p => p.category === 'star').map(p => p.name).join('، ')}</p>
          )}
          {matrix.filter(p => p.category === 'dog').length > 0 && (
            <p className="flex items-start gap-2"><Trash2 className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              محصولات زیان‌ده (فروش پایین و سود پایین) را حذف یا بازطراحی کنید: {matrix.filter(p => p.category === 'dog').map(p => p.name).join('، ')}</p>
          )}
          {matrix.filter(p => p.category === 'puzzle').length > 0 && (
            <p className="flex items-start gap-2"><Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              محصولات پازل (سود بالا اما فروش پایین) نیاز به تبلیغات بیشتر دارند: {matrix.filter(p => p.category === 'puzzle').map(p => p.name).join('، ')}</p>
          )}
          {matrix.filter(p => p.category === 'workhorse').length > 0 && (
            <p className="flex items-start gap-2"><ArrowUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              محصولات کارگر (فروش بالا اما سود پایین) را با افزایش قیمت یا کاهش هزینه بهینه کنید: {matrix.filter(p => p.category === 'workhorse').map(p => p.name).join('، ')}</p>
          )}
          {matrix.filter(p => p.foodCostPercent > 40).length > 0 && (
            <p className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              هزینه غذا بیش از ۴۰٪ است برای: {matrix.filter(p => p.foodCostPercent > 40).map(p => p.name).join('، ')} — افزایش قیمت یا کاهش مواد اولیه توصیه می‌شود</p>
          )}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800 text-sm">ماتریس مهندسی منو</h3>
          <button onClick={exportAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            <Download className="w-4 h-4" /><span>خروجی</span>
          </button>
        </div>
        {matrix.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">محصولی موجود نیست</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">محصول</th>
                  <th className="text-right font-medium px-4 py-3">دسته</th>
                  <th className="text-right font-medium px-4 py-3">فروش</th>
                  <th className="text-right font-medium px-4 py-3">درآمد</th>
                  <th className="text-right font-medium px-4 py-3">هزینه</th>
                  <th className="text-right font-medium px-4 py-3">سود</th>
                  <th className="text-right font-medium px-4 py-3">حاشیه</th>
                  <th className="text-right font-medium px-4 py-3">هزینه غذا</th>
                  <th className="text-right font-medium px-4 py-3">دسته‌بندی</th>
                </tr>
              </thead>
              <tbody>
                {matrix.sort((a, b) => b.profit - a.profit).map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-700">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.product_categories?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{p.totalSold.toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3 text-gray-700" dir="ltr">{Math.round(p.totalRevenue).toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3 text-red-500" dir="ltr">{Math.round(p.totalCost).toLocaleString('fa-IR')}</td>
                    <td className={`px-4 py-3 font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} dir="ltr">{Math.round(p.profit).toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{Math.round(p.margin)}٪</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${p.foodCostPercent > 40 ? 'bg-red-50 text-red-600' : p.foodCostPercent > 30 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {Math.round(p.foodCostPercent)}٪
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryColors[p.category]}`}>
                        {categoryLabels[p.category]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const categoryLabels: Record<string, string> = {
  star: 'ستاره', workhorse: 'کارگر', puzzle: 'پازل', dog: 'زیان‌ده',
};
const categoryColors: Record<string, string> = {
  star: 'bg-emerald-50 text-emerald-600', workhorse: 'bg-blue-50 text-blue-600',
  puzzle: 'bg-amber-50 text-amber-600', dog: 'bg-red-50 text-red-600',
};

function StatCard({ icon: Icon, label, value, color, bg }: { icon: typeof TrendingUp; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-lg font-bold text-gray-800" dir="ltr">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
