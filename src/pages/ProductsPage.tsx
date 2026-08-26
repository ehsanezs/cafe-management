import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Edit3, Trash2, X, Package, ChefHat,
  AlertCircle, Loader2, Tag, Boxes, ArrowRight, Save, History
} from 'lucide-react';

type Product = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  product_type: string;
  unit_id: string;
  sale_price: number;
  purchase_price: number;
  tax_rate: number;
  max_discount_percent: number;
  is_active: boolean;
  min_stock: number;
  max_stock: number | null;
  packaging_cost: number;
  target_food_cost_percent: number | null;
  available_days: string[] | null;
  show_as_out_of_stock: boolean;
  created_at: string;
  updated_at: string;
  product_categories?: { name: string } | null;
  units?: { name: string; symbol: string } | null;
};

const dayOptions: { key: string; label: string }[] = [
  { key: 'sat', label: 'شنبه' },
  { key: 'sun', label: 'یکشنبه' },
  { key: 'mon', label: 'دوشنبه' },
  { key: 'tue', label: 'سه‌شنبه' },
  { key: 'wed', label: 'چهارشنبه' },
  { key: 'thu', label: 'پنجشنبه' },
  { key: 'fri', label: 'جمعه' },
];

type Category = { id: string; name: string; parent_id: string | null };
type Unit = { id: string; name: string; symbol: string; is_base: boolean };

type RecipeVersion = {
  id: string;
  version_number: number;
  status: string;
  effective_from: string;
  superseded_at: string | null;
  calculated_cost_per_serving: number | null;
  created_at: string;
};

type RecipeItem = {
  id: string;
  ingredient_product_id: string;
  quantity: number;
  unit_id: string;
  waste_percent: number;
  cost_at_publish: number | null;
  products?: { name: string } | null;
  units?: { name: string; symbol: string } | null;
};

const productTypeLabels: Record<string, string> = {
  finished: 'محصول نهایی',
  ingredient: 'ماده اولیه',
  semi_finished: 'نیمه‌آماده',
  purchased: 'خریدی',
};

const productTypeColors: Record<string, string> = {
  finished: 'bg-amber-50 text-amber-600',
  ingredient: 'bg-blue-50 text-blue-600',
  semi_finished: 'bg-purple-50 text-purple-600',
  purchased: 'bg-emerald-50 text-emerald-600',
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showRecipe, setShowRecipe] = useState<Product | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select(`
        *,
        product_categories ( name ),
        units ( name, symbol )
      `)
      .order('created_at', { ascending: false });

    if (typeFilter !== 'all') {
      query = query.eq('product_type', typeFilter);
    }
    if (categoryFilter !== 'all') {
      query = query.eq('category_id', categoryFilter);
    }
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts((data as Product[]) || []);
    }
    setLoading(false);
  }, [search, typeFilter, categoryFilter]);

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: uns }] = await Promise.all([
        supabase.from('product_categories').select('id, name, parent_id').eq('is_active', true).order('display_order'),
        supabase.from('units').select('id, name, symbol, is_base').order('name'),
      ]);
      setCategories((cats as Category[]) || []);
      setUnits((uns as Unit[]) || []);
    })();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این محصول مطمئن هستید؟ این عمل قابل بازگشت نیست.')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      alert('خطا در حذف محصول: ' + error.message);
    } else {
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی محصول یا SKU..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white"
        >
          <option value="all">همه انواع</option>
          <option value="finished">محصول نهایی</option>
          <option value="ingredient">ماده اولیه</option>
          <option value="semi_finished">نیمه‌آماده</option>
          <option value="purchased">خریدی</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white"
        >
          <option value="all">همه دسته‌ها</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>محصول جدید</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">هنوز محصولی ثبت نشده است</p>
            <button
              onClick={() => { setEditingProduct(null); setShowModal(true); }}
              className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              اولین محصول را اضافه کنید
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">نام محصول</th>
                  <th className="text-right font-medium px-4 py-3">نوع</th>
                  <th className="text-right font-medium px-4 py-3">دسته</th>
                  <th className="text-right font-medium px-4 py-3">واحد</th>
                  <th className="text-right font-medium px-4 py-3">قیمت فروش</th>
                  <th className="text-right font-medium px-4 py-3">قیمت خرید</th>
                  <th className="text-right font-medium px-4 py-3">وضعیت</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.name}</div>
                      {p.sku && <div className="text-xs text-gray-400" dir="ltr">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${productTypeColors[p.product_type] || 'bg-gray-50 text-gray-500'}`}>
                        {productTypeLabels[p.product_type] || p.product_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.product_categories?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.units?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium" dir="ltr">
                      {Number(p.sale_price).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3 text-gray-500" dir="ltr">
                      {Number(p.purchase_price).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${p.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                          {p.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                        {p.show_as_out_of_stock && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600">ناموجود</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {(p.product_type === 'finished' || p.product_type === 'semi_finished') && (
                          <button
                            onClick={() => setShowRecipe(p)}
                            title="مدیریت رسپی"
                            className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <ChefHat className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingProduct(p); setShowModal(true); }}
                          title="ویرایش"
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          title="حذف"
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          units={units}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData(); }}
        />
      )}

      {/* Recipe Modal */}
      {showRecipe && (
        <RecipeModal
          product={showRecipe}
          units={units}
          ingredients={products.filter(p => p.product_type === 'ingredient' || p.product_type === 'semi_finished')}
          onClose={() => setShowRecipe(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Product Modal
// ============================================================
function ProductModal({
  product, categories, units, onClose, onSaved
}: {
  product: Product | null;
  categories: Category[];
  units: Unit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    description: product?.description || '',
    category_id: product?.category_id || '',
    product_type: product?.product_type || 'finished',
    unit_id: product?.unit_id || units[0]?.id || '',
    sale_price: product?.sale_price || 0,
    purchase_price: product?.purchase_price || 0,
    tax_rate: product?.tax_rate || 0,
    max_discount_percent: product?.max_discount_percent || 100,
    is_active: product?.is_active ?? true,
    min_stock: product?.min_stock || 0,
    max_stock: product?.max_stock || '',
    packaging_cost: product?.packaging_cost || 0,
    target_food_cost_percent: product?.target_food_cost_percent || '',
    available_days: product?.available_days || ['sat','sun','mon','tue','wed','thu','fri'],
    show_as_out_of_stock: product?.show_as_out_of_stock ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      sku: form.sku || null,
      barcode: form.barcode || null,
      category_id: form.category_id || null,
      max_stock: form.max_stock === '' ? null : Number(form.max_stock),
      target_food_cost_percent: form.target_food_cost_percent === '' ? null : Number(form.target_food_cost_percent),
      sale_price: Number(form.sale_price),
      purchase_price: Number(form.purchase_price),
      tax_rate: Number(form.tax_rate),
      max_discount_percent: Number(form.max_discount_percent),
      min_stock: Number(form.min_stock),
      packaging_cost: Number(form.packaging_cost),
      available_days: form.available_days,
    };

    let result;
    if (product) {
      result = await supabase.from('products').update(payload).eq('id', product.id);
    } else {
      result = await supabase.from('products').insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <Modal onClose={onClose} title={product ? 'ویرایش محصول' : 'محصول جدید'} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="نام محصول" required>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
              className="modal-input" />
          </Field>
          <Field label="SKU / کد محصول">
            <input type="text" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} dir="ltr"
              className="modal-input" placeholder="اختیاری" />
          </Field>
          <Field label="بارکد">
            <input type="text" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} dir="ltr"
              className="modal-input" placeholder="اختیاری" />
          </Field>
          <Field label="نوع محصول" required>
            <select value={form.product_type} onChange={e => setForm({...form, product_type: e.target.value})}
              className="modal-input">
              <option value="finished">محصول نهایی</option>
              <option value="ingredient">ماده اولیه</option>
              <option value="semi_finished">نیمه‌آماده</option>
              <option value="purchased">خریدی</option>
            </select>
          </Field>
          <Field label="دسته‌بندی">
            <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
              className="modal-input">
              <option value="">بدون دسته</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="واحد" required>
            <select value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})} required
              className="modal-input">
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
            </select>
          </Field>
          <Field label="قیمت فروش (تومان)">
            <input type="number" value={form.sale_price} onChange={e => setForm({...form, sale_price: Number(e.target.value)})}
              min="0" dir="ltr" className="modal-input" />
          </Field>
          <Field label="قیمت خرید (تومان)">
            <input type="number" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: Number(e.target.value)})}
              min="0" dir="ltr" className="modal-input" />
          </Field>
          <Field label="نرخ مالیات (%)">
            <input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: Number(e.target.value)})}
              min="0" max="100" step="0.01" dir="ltr" className="modal-input" />
          </Field>
          <Field label="حداکثر تخفیف (%)">
            <input type="number" value={form.max_discount_percent} onChange={e => setForm({...form, max_discount_percent: Number(e.target.value)})}
              min="0" max="100" dir="ltr" className="modal-input" />
          </Field>
          <Field label="حداقل موجودی">
            <input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: Number(e.target.value)})}
              min="0" dir="ltr" className="modal-input" />
          </Field>
          <Field label="حداکثر موجودی">
            <input type="number" value={form.max_stock} onChange={e => setForm({...form, max_stock: e.target.value})}
              min="0" dir="ltr" className="modal-input" placeholder="اختیاری" />
          </Field>
          <Field label="هزینه بسته‌بندی (تومان)">
            <input type="number" value={form.packaging_cost} onChange={e => setForm({...form, packaging_cost: Number(e.target.value)})}
              min="0" dir="ltr" className="modal-input" />
          </Field>
          <Field label="هدف درصد هزینه غذا">
            <input type="number" value={form.target_food_cost_percent} onChange={e => setForm({...form, target_food_cost_percent: e.target.value})}
              min="0" max="100" dir="ltr" className="modal-input" placeholder="اختیاری" />
          </Field>
        </div>

        <Field label="توضیحات">
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            rows={2} className="modal-input" placeholder="اختیاری" />
        </Field>

        {/* Available Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">روزهای موجودی</label>
          <div className="flex flex-wrap gap-2">
            {dayOptions.map(d => {
              const selected = form.available_days.includes(d.key);
              return (
                <button key={d.key} type="button"
                  onClick={() => setForm({
                    ...form,
                    available_days: selected
                      ? form.available_days.filter(x => x !== d.key)
                      : [...form.available_days, d.key],
                  })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Show as out of stock */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.show_as_out_of_stock} onChange={e => setForm({...form, show_as_out_of_stock: e.target.checked})}
            className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-sm text-gray-600">نمایش به‌عنوان ناموجود (حتی اگر موجودی دارد)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})}
            className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-sm text-gray-600">فعال</span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{product ? 'ذخیره تغییرات' : 'ایجاد محصول'}</span>
          </button>
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            انصراف
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Recipe Modal
// ============================================================
function RecipeModal({
  product, units, ingredients, onClose
}: {
  product: Product;
  units: Unit[];
  ingredients: Product[];
  onClose: () => void;
}) {
  const [recipe, setRecipe] = useState<{ id: string; is_active: boolean } | null>(null);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<RecipeVersion | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    ingredient_product_id: '',
    quantity: 0,
    unit_id: '',
    waste_percent: 0,
  });

  const fetchRecipe = useCallback(async () => {
    setLoading(true);
    const { data: recipeData } = await supabase
      .from('recipes')
      .select('id, is_active')
      .eq('product_id', product.id)
      .maybeSingle();

    if (!recipeData) {
      setRecipe(null);
      setLoading(false);
      return;
    }

    setRecipe(recipeData);

    const { data: versionsData } = await supabase
      .from('recipe_versions')
      .select('*')
      .eq('recipe_id', recipeData.id)
      .order('version_number', { ascending: false });

    setVersions((versionsData as RecipeVersion[]) || []);

    const active = (versionsData as RecipeVersion[])?.find(v => v.status === 'active');
    if (active) {
      setActiveVersion(active);
      const { data: itemsData } = await supabase
        .from('recipe_items')
        .select(`
          *,
          products!recipe_items_ingredient_product_id_fkey ( name ),
          units ( name, symbol )
        `)
        .eq('recipe_version_id', active.id);
      setItems((itemsData as RecipeItem[]) || []);
    }

    setLoading(false);
  }, [product.id]);

  useEffect(() => { fetchRecipe(); }, [fetchRecipe]);

  const handleCreateRecipe = async () => {
    const { data, error } = await supabase
      .from('recipes')
      .insert({ product_id: product.id, is_active: true })
      .select('id, is_active')
      .single();

    if (error) {
      alert('خطا در ایجاد رسپی: ' + error.message);
      return;
    }

    const { error: vError } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: data.id,
        version_number: 1,
        status: 'draft',
        effective_from: new Date().toISOString(),
      });

    if (vError) {
      alert('خطا در ایجاد نسخه: ' + vError.message);
      return;
    }

    fetchRecipe();
  };

  const handleAddItem = async () => {
    if (!activeVersion || !newItem.ingredient_product_id || newItem.quantity <= 0) return;

    const { error } = await supabase.from('recipe_items').insert({
      recipe_version_id: activeVersion.id,
      ingredient_product_id: newItem.ingredient_product_id,
      quantity: Number(newItem.quantity),
      unit_id: newItem.unit_id || units[0]?.id,
      waste_percent: Number(newItem.waste_percent) || 0,
    });

    if (error) {
      alert('خطا در افزودن ماده: ' + error.message);
      return;
    }

    setNewItem({ ingredient_product_id: '', quantity: 0, unit_id: '', waste_percent: 0 });
    setShowAddItem(false);
    fetchRecipe();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('حذف این ماده از رسپی؟')) return;
    await supabase.from('recipe_items').delete().eq('id', itemId);
    fetchRecipe();
  };

  const handlePublish = async () => {
    if (!activeVersion || !recipe) return;
    if (items.length === 0) {
      alert('حداقل یک ماده اولیه اضافه کنید');
      return;
    }

    const totalCost = items.reduce((sum, item) => {
      const ingredient = ingredients.find(i => i.id === item.ingredient_product_id);
      const cost = ingredient?.purchase_price || 0;
      const wasteMultiplier = 1 + (Number(item.waste_percent) || 0) / 100;
      return sum + (cost * Number(item.quantity) * wasteMultiplier);
    }, 0);

    const { error: updateOld } = await supabase
      .from('recipe_versions')
      .update({ status: 'superseded', superseded_at: new Date().toISOString() })
      .eq('recipe_id', recipe.id)
      .eq('status', 'active');

    if (updateOld) {
      alert('خطا در به‌روزرسانی نسخه قبلی: ' + updateOld.message);
      return;
    }

    const { data: itemsForCost } = await supabase
      .from('recipe_items')
      .select('ingredient_product_id, quantity, waste_percent')
      .eq('recipe_version_id', activeVersion.id);

    const updatePromises = (itemsForCost || []).map(async (item: any) => {
      const ingredient = ingredients.find(i => i.id === item.ingredient_product_id);
      const cost = ingredient?.purchase_price || 0;
      const wasteMultiplier = 1 + (Number(item.waste_percent) || 0) / 100;
      const itemCost = cost * Number(item.quantity) * wasteMultiplier;
      return supabase.from('recipe_items')
        .update({ cost_at_publish: itemCost })
        .eq('id', item.id);
    });

    await Promise.all(updatePromises);

    const { error: publishError } = await supabase
      .from('recipe_versions')
      .update({
        status: 'active',
        effective_from: new Date().toISOString(),
        calculated_cost_per_serving: totalCost,
      })
      .eq('id', activeVersion.id);

    if (publishError) {
      alert('خطا در انتشار نسخه: ' + publishError.message);
      return;
    }

    alert('نسخه رسپی با موفقیت منتشر شد. هزینه هر پرس: ' + Math.round(totalCost).toLocaleString('fa-IR') + ' تومان');
    fetchRecipe();
  };

  const handleNewVersion = async () => {
    if (!recipe) return;
    const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;

    const { error } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipe.id,
        version_number: nextVersion,
        status: 'draft',
        effective_from: new Date().toISOString(),
      });

    if (error) {
      alert('خطا: ' + error.message);
      return;
    }

    fetchRecipe();
  };

  if (loading) {
    return (
      <Modal onClose={onClose} title={`رسپی: ${product.name}`} wide>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={`رسپی: ${product.name}`} wide>
      <div className="space-y-4">
        {!recipe ? (
          <div className="text-center py-12">
            <ChefHat className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">هنوز رسپی برای این محصول ایجاد نشده است</p>
            <button onClick={handleCreateRecipe}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100">
              <Plus className="w-4 h-4" />
              <span>ایجاد رسپی</span>
            </button>
          </div>
        ) : (
          <>
            {/* Versions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {versions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setActiveVersion(v);
                      (async () => {
                        const { data } = await supabase
                          .from('recipe_items')
                          .select(`*, products!recipe_items_ingredient_product_id_fkey ( name ), units ( name, symbol )`)
                          .eq('recipe_version_id', v.id);
                        setItems((data as RecipeItem[]) || []);
                      })();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeVersion?.id === v.id
                        ? 'bg-amber-500 text-white shadow-md shadow-orange-100'
                        : v.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600'
                        : v.status === 'draft'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    نسخه {v.version_number}
                    {v.status === 'active' && ' (فعال)'}
                    {v.status === 'draft' && ' (پیش‌نویس)'}
                    {v.status === 'superseded' && ' (قدیمی)'}
                  </button>
                ))}
              </div>
              <button onClick={handleNewVersion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                <History className="w-3.5 h-3.5" />
                <span>نسخه جدید</span>
              </button>
            </div>

            {/* Cost summary */}
            {activeVersion?.calculated_cost_per_serving != null && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-amber-700">هزینه محاسبه‌شده هر پرس</span>
                <span className="text-lg font-bold text-amber-700" dir="ltr">
                  {Math.round(activeVersion.calculated_cost_per_serving).toLocaleString('fa-IR')} تومان
                </span>
              </div>
            )}

            {/* Items */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <h4 className="text-sm font-semibold text-gray-700">مواد اولیه</h4>
                {activeVersion?.status === 'draft' && (
                  <button onClick={() => setShowAddItem(!showAddItem)}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن ماده</span>
                  </button>
                )}
              </div>

              {showAddItem && activeVersion?.status === 'draft' && (
                <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select value={newItem.ingredient_product_id}
                      onChange={e => setNewItem({...newItem, ingredient_product_id: e.target.value})}
                      className="modal-input text-sm">
                      <option value="">انتخاب ماده...</option>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" placeholder="مقدار" value={newItem.quantity || ''}
                      onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})}
                      min="0" dir="ltr" className="modal-input text-sm" />
                    <select value={newItem.unit_id}
                      onChange={e => setNewItem({...newItem, unit_id: e.target.value})}
                      className="modal-input text-sm">
                      <option value="">واحد...</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input type="number" placeholder="پرت %" value={newItem.waste_percent || ''}
                        onChange={e => setNewItem({...newItem, waste_percent: Number(e.target.value)})}
                        min="0" dir="ltr" className="modal-input text-sm" />
                      <button onClick={handleAddItem}
                        className="px-3 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  هنوز ماده‌ای اضافه نشده است
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-gray-400 text-xs">
                      <th className="text-right font-medium px-4 py-2">ماده اولیه</th>
                      <th className="text-right font-medium px-4 py-2">مقدار</th>
                      <th className="text-right font-medium px-4 py-2">واحد</th>
                      <th className="text-right font-medium px-4 py-2">پرت (%)</th>
                      <th className="text-right font-medium px-4 py-2">هزینه</th>
                      {activeVersion?.status === 'draft' && <th className="px-4 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-700">{item.products?.name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600" dir="ltr">{Number(item.quantity).toLocaleString('fa-IR')}</td>
                        <td className="px-4 py-2.5 text-gray-500">{item.units?.name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500" dir="ltr">{Number(item.waste_percent).toLocaleString('fa-IR')}</td>
                        <td className="px-4 py-2.5 text-gray-600" dir="ltr">
                          {item.cost_at_publish != null ? Math.round(Number(item.cost_at_publish)).toLocaleString('fa-IR') : '—'}
                        </td>
                        {activeVersion?.status === 'draft' && (
                          <td className="px-4 py-2.5">
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Publish button */}
            {activeVersion?.status === 'draft' && (
              <button onClick={handlePublish}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-l from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow-md shadow-emerald-100 hover:shadow-lg transition-all">
                <Save className="w-4 h-4" />
                <span>انتشار نسخه و محاسبه هزینه</span>
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// Shared components
// ============================================================
function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-md'} w-full max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
