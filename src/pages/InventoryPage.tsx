import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal, Field } from '@/pages/SuppliersPage';
import { useAuth } from '@/lib/auth';
import {
  Search, Package, AlertTriangle, Loader2, Save, Plus, Minus,
  ClipboardList, TrendingDown, Boxes
} from 'lucide-react';

type Unit = { id: string; name: string; symbol: string };

type ProductInfo = {
  name: string;
  product_type: string;
  min_stock: number;
  max_stock: number | null;
  unit_id: string;
  purchase_price: number;
  sale_price: number;
};

type InventoryRow = {
  id: string;
  product_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  last_movement_date: string | null;
  updated_at: string;
  products?: ProductInfo | null;
  units?: { name: string; symbol: string } | null;
};

type MovementRow = {
  id: string;
  movement_date: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  reference_type: string | null;
  products?: { name: string } | null;
  units?: { name: string; symbol: string } | null;
};

const movementTypeLabels: Record<string, string> = {
  purchase: 'خرید',
  sale: 'فروش',
  adjustment: 'تعدیل',
  waste: 'ضایعات',
  transfer_in: 'انتقال ورودی',
  transfer_out: 'انتقال خروجی',
  production: 'تولید',
};

const movementTypeColors: Record<string, string> = {
  purchase: 'text-emerald-600',
  sale: 'text-red-600',
  adjustment: 'text-blue-600',
  waste: 'text-amber-600',
  transfer_in: 'text-emerald-600',
  transfer_out: 'text-red-600',
  production: 'text-purple-600',
};

export function InventoryPage() {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdjust, setShowAdjust] = useState<InventoryRow | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data: invData, error } = await supabase
      .from('inventory_balances')
      .select(`
        id, product_id, quantity_on_hand, quantity_reserved, last_movement_date, updated_at,
        products!inventory_balances_product_id_fkey ( name, product_type, min_stock, max_stock, unit_id, purchase_price, sale_price )
      `)
      .order('updated_at', { ascending: false });

    if (!error && invData) {
      const productIds = (invData as any[]).map(r => r.product_id);
      let unitsMap: Record<string, { name: string; symbol: string }> = {};
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, unit_id, units!products_unit_id_fkey ( name, symbol )')
          .in('id', productIds);
        (prods as any[] || []).forEach(p => {
          if (p.units) unitsMap[p.id] = p.units;
        });
      }
      const enriched = (invData as any[]).map(row => ({
        ...row,
        units: unitsMap[row.product_id] || null,
      }));
      setInventory(enriched as InventoryRow[]);
    } else {
      setInventory([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const fetchMovements = useCallback(async () => {
    setMovementsLoading(true);
    const { data } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products!stock_movements_product_id_fkey ( name ),
        units!stock_movements_unit_id_fkey ( name, symbol )
      `)
      .order('movement_date', { ascending: false })
      .limit(50);
    setMovements((data as MovementRow[]) || []);
    setMovementsLoading(false);
  }, []);

  const filteredInventory = search.trim()
    ? inventory.filter(i => i.products?.name?.toLowerCase().includes(search.toLowerCase()))
    : inventory;

  const lowStockItems = filteredInventory.filter(i =>
    i.products && Number(i.quantity_on_hand) <= Number(i.products.min_stock) && Number(i.products.min_stock) > 0
  );
  const outOfStockItems = filteredInventory.filter(i => Number(i.quantity_on_hand) <= 0);
  const totalItems = filteredInventory.length;
  const totalValue = filteredInventory.reduce((sum, i) => sum + (Number(i.quantity_on_hand) * Number(i.products?.purchase_price || 0)), 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Boxes} label="کل اقلام" value={totalItems.toLocaleString('fa-IR')} color="#3b82f6" bg="bg-blue-50" />
        <StatCard icon={Package} label="موجودی صفر" value={outOfStockItems.length.toLocaleString('fa-IR')} color="#ef4444" bg="bg-red-50" />
        <StatCard icon={AlertTriangle} label="موجودی کم" value={lowStockItems.length.toLocaleString('fa-IR')} color="#f59e0b" bg="bg-amber-50" />
        <StatCard icon={TrendingDown} label="ارزش انبار" value={Math.round(totalValue).toLocaleString('fa-IR') + ' ت'} color="#10b981" bg="bg-emerald-50" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی محصول..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all" />
        </div>
        <button onClick={() => { fetchMovements(); setShowMovements(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
          <ClipboardList className="w-4 h-4" /><span>تاریخچه حرکات</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">موجودی انبار خالی است</p>
            <p className="text-xs text-gray-300 mt-1">با ثبت سفارش خرید و دریافت کالا، موجودی به‌روز می‌شود</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">محصول</th>
                  <th className="text-right font-medium px-4 py-3">موجودی</th>
                  <th className="text-right font-medium px-4 py-3">رزرو شده</th>
                  <th className="text-right font-medium px-4 py-3">موجودی واقعی</th>
                  <th className="text-right font-medium px-4 py-3">حداقل</th>
                  <th className="text-right font-medium px-4 py-3">وضعیت</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((row) => {
                  const onHand = Number(row.quantity_on_hand);
                  const reserved = Number(row.quantity_reserved);
                  const available = onHand - reserved;
                  const minStock = Number(row.products?.min_stock || 0);
                  const isOutOfStock = onHand <= 0;
                  const isLowStock = onHand > 0 && minStock > 0 && onHand <= minStock;

                  return (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{row.products?.name || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium" dir="ltr">
                        {onHand.toLocaleString('fa-IR')} {row.units?.symbol || ''}
                      </td>
                      <td className="px-4 py-3 text-gray-500" dir="ltr">
                        {reserved > 0 ? reserved.toLocaleString('fa-IR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600" dir="ltr">
                        {available.toLocaleString('fa-IR')} {row.units?.symbol || ''}
                      </td>
                      <td className="px-4 py-3 text-gray-500" dir="ltr">
                        {minStock > 0 ? minStock.toLocaleString('fa-IR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isOutOfStock ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">ناموجود</span>
                        ) : isLowStock ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">موجودی کم</span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">موجود</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setShowAdjust(row)}
                          className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="تعدیل موجودی">
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      {showAdjust && (
        <AdjustModal
          row={showAdjust}
          onClose={() => setShowAdjust(null)}
          onSaved={() => { setShowAdjust(null); fetchInventory(); }}
        />
      )}

      {/* Movements Modal */}
      {showMovements && (
        <Modal onClose={() => setShowMovements(false)} title="تاریخچه حرکات انبار (۵۰ مورد اخیر)" wide>
          {movementsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">حرکتی ثبت نشده است</div>
          ) : (
            <div className="space-y-2">
              {movements.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${Number(m.quantity) > 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {Number(m.quantity) > 0 ? <Plus className="w-4 h-4 text-emerald-600" /> : <Minus className="w-4 h-4 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{m.products?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{movementTypeLabels[m.movement_type] || m.movement_type} — {new Date(m.movement_date).toLocaleDateString('fa-IR')}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className={`font-bold text-sm ${movementTypeColors[m.movement_type] || 'text-gray-600'}`} dir="ltr">
                      {Number(m.quantity) > 0 ? '+' : ''}{Number(m.quantity).toLocaleString('fa-IR')} {m.units?.symbol || ''}
                    </span>
                    {m.notes && <p className="text-xs text-gray-400 mt-0.5">{m.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: typeof Package; label: string; value: string; color: string; bg: string }) {
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

function AdjustModal({ row, onClose, onSaved }: {
  row: InventoryRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [adjustType, setAdjustType] = useState<'add' | 'subtract' | 'set'>('add');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let movementQty = 0;
    if (adjustType === 'add') movementQty = quantity;
    else if (adjustType === 'subtract') movementQty = -quantity;
    else if (adjustType === 'set') movementQty = quantity - Number(row.quantity_on_hand);

    if (movementQty === 0) { setError('تغییری برای ثبت وجود ندارد'); setSaving(false); return; }

    const { error: movError } = await supabase.from('stock_movements').insert({
      product_id: row.product_id,
      movement_type: 'adjustment',
      quantity: movementQty,
      unit_id: row.products?.unit_id || row.product_id,
      notes: reason || `تعدیل دستی: ${adjustType === 'add' ? 'افزایش' : adjustType === 'subtract' ? 'کاهش' : 'تنظیم'}`,
      created_by: profile?.id || null,
    });

    if (movError) { setError(movError.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <Modal onClose={onClose} title={`تعدیل موجودی: ${row.products?.name || ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}

        <div className="bg-gray-50/50 rounded-xl px-4 py-3 text-sm text-gray-600">
          موجودی فعلی: <span className="font-bold text-gray-800" dir="ltr">{Number(row.quantity_on_hand).toLocaleString('fa-IR')} {row.units?.symbol || ''}</span>
        </div>

        <Field label="نوع تعدیل" required>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setAdjustType('add')}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${adjustType === 'add' ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <Plus className="w-4 h-4 mx-auto mb-1" /><span>افزایش</span>
            </button>
            <button type="button" onClick={() => setAdjustType('subtract')}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${adjustType === 'subtract' ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <Minus className="w-4 h-4 mx-auto mb-1" /><span>کاهش</span>
            </button>
            <button type="button" onClick={() => setAdjustType('set')}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${adjustType === 'set' ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <span className="block mb-1">=</span><span>تنظیم</span>
            </button>
          </div>
        </Field>

        <Field label={adjustType === 'set' ? 'مقدار جدید' : 'مقدار'} required>
          <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))}
            min="0" dir="ltr" className="modal-input" placeholder="0" />
        </Field>

        <Field label="دلیل تعدیل">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="modal-input" placeholder="اختیاری" />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ثبت تعدیل</span>
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
        </div>
      </form>
    </Modal>
  );
}
