import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal, Field } from '@/pages/SuppliersPage';
import { useAuth } from '@/lib/auth';
import {
  Plus, Search, X, Receipt, AlertCircle, Loader2, Save, Trash2,
  Package, CheckCircle2, Clock, ArrowLeft, ArrowRight
} from 'lucide-react';

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; purchase_price: number; unit_id: string };
type Unit = { id: string; name: string; symbol: string };

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  branch_id: string | null;
  status: string;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  suppliers?: { name: string } | null;

};

type POItem = {
  id: string;
  po_id: string;
  product_id: string;
  quantity: number;
  unit_id: string;
  unit_price: number;
  discount_percent: number;
  received_quantity: number;
  line_total: number;
  products?: { name: string } | null;
  units?: { name: string; symbol: string } | null;
};

const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس',
  sent: 'ارسال شده',
  partially_received: 'دریافت جزئی',
  received: 'دریافت کامل',
  cancelled: 'لغو شده',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  partially_received: 'bg-amber-50 text-amber-600',
  received: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-600',
};

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<PurchaseOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('purchase_orders')
      .select(`*, suppliers ( name )`)
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search.trim()) query = query.or(`po_number.ilike.%${search}%`);
    const { data, error } = await query;
    if (!error) setOrders((data as PurchaseOrder[]) || []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    (async () => {
      const { data: sups } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name');
      setSuppliers((sups as Supplier[]) || []);
    })();
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو شماره سفارش..." dir="ltr"
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white">
          <option value="all">همه وضعیت‌ها</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap">
          <Plus className="w-4 h-4" /><span>سفارش خرید جدید</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">هنوز سفارش خریدی ثبت نشده است</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">شماره سفارش</th>
                  <th className="text-right font-medium px-4 py-3">تأمین‌کننده</th>
                  <th className="text-right font-medium px-4 py-3">تاریخ</th>
                  <th className="text-right font-medium px-4 py-3">مبلغ کل</th>
                  <th className="text-right font-medium px-4 py-3">وضعیت</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setViewing(o)}>
                    <td className="px-4 py-3 font-medium text-gray-800" dir="ltr">{o.po_number}</td>
                    <td className="px-4 py-3 text-gray-600">{o.suppliers?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(o.order_date).toLocaleDateString('fa-IR')}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium" dir="ltr">{Number(o.total_amount).toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[o.status] || 'bg-gray-50 text-gray-500'}`}>
                        {statusLabels[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}

      {viewing && (
        <ViewPOModal
          order={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => { setViewing(null); fetchOrders(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Create PO Modal
// ============================================================
function CreatePOModal({ suppliers, onClose, onSaved }: {
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<Array<{ product_id: string; quantity: number; unit_id: string; unit_price: number; discount_percent: number }>>([]);
  const [newItem, setNewItem] = useState({ product_id: '', quantity: 1, unit_id: '', unit_price: 0, discount_percent: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: uns }] = await Promise.all([
        supabase.from('products').select('id, name, purchase_price, unit_id').eq('is_active', true).order('name'),
        supabase.from('units').select('id, name, symbol').order('name'),
      ]);
      setProducts((prods as Product[]) || []);
      setUnits((uns as Unit[]) || []);
    })();
  }, []);

  const addItem = () => {
    if (!newItem.product_id || newItem.quantity <= 0) return;
    const product = products.find(p => p.id === newItem.product_id);
    setItems([...items, {
      ...newItem,
      unit_id: newItem.unit_id || product?.unit_id || '',
      unit_price: newItem.unit_price || product?.purchase_price || 0,
    }]);
    setNewItem({ product_id: '', quantity: 1, unit_id: '', unit_price: 0, discount_percent: 0 });
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
    return sum + lineTotal;
  }, 0);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDiscount * taxRate / 100;
  const total = afterDiscount + taxAmount;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    if (!supplierId || items.length === 0) {
      setError('تأمین‌کننده و حداقل یک قلم الزامی است');
      setSaving(false);
      return;
    }

    const { data: seqData, error: seqError } = await supabase.rpc('next_number', {
      p_sequence_key: 'purchase_order',
    });
    if (seqError) { setError('خطا در تولید شماره: ' + seqError.message); setSaving(false); return; }

    const poNumber = seqData as string;

    const { data: poData, error: poError } = await supabase.from('purchase_orders').insert({
      po_number: poNumber,
      supplier_id: supplierId,
      status: 'draft',
      expected_date: expectedDate || null,
      notes: notes || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: total,
      created_by: profile?.id || null,
    }).select('id').single();

    if (poError) { setError(poError.message); setSaving(false); return; }

    const itemInserts = items.map(item => ({
      po_id: poData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_id: item.unit_id,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      line_total: item.quantity * item.unit_price * (1 - item.discount_percent / 100),
    }));

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemInserts);
    if (itemsError) { setError(itemsError.message); setSaving(false); return; }

    onSaved();
  };

  return (
    <Modal onClose={onClose} title="سفارش خرید جدید" wide>
      <div className="space-y-4">
        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="تأمین‌کننده" required>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="modal-input">
              <option value="">انتخاب...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="تاریخ تحویل مورد انتظار">
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} dir="ltr" className="modal-input" />
          </Field>
        </div>

        {/* Items */}
        <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">اقلام سفارش</h4>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <select value={newItem.product_id} onChange={e => {
              const p = products.find(pr => pr.id === e.target.value);
              setNewItem({ ...newItem, product_id: e.target.value, unit_id: p?.unit_id || '', unit_price: p?.purchase_price || 0 });
            }} className="modal-input text-sm sm:col-span-2">
              <option value="">انتخاب محصول...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="مقدار" value={newItem.quantity || ''} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} min="0" dir="ltr" className="modal-input text-sm" />
            <input type="number" placeholder="قیمت واحد" value={newItem.unit_price || ''} onChange={e => setNewItem({ ...newItem, unit_price: Number(e.target.value) })} min="0" dir="ltr" className="modal-input text-sm" />
            <button onClick={addItem} className="flex items-center justify-center gap-1 px-3 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
              <Plus className="w-4 h-4" /><span>افزودن</span>
            </button>
          </div>

          {items.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-gray-400 text-xs">
                    <th className="text-right font-medium px-3 py-2">محصول</th>
                    <th className="text-right font-medium px-3 py-2">مقدار</th>
                    <th className="text-right font-medium px-3 py-2">قیمت واحد</th>
                    <th className="text-right font-medium px-3 py-2">جمع</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const product = products.find(p => p.id === item.product_id);
                    const unit = units.find(u => u.id === item.unit_id);
                    const lineTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                    return (
                      <tr key={idx} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 text-gray-700">{product?.name || '—'}</td>
                        <td className="px-3 py-2 text-gray-600" dir="ltr">{item.quantity} {unit?.symbol || ''}</td>
                        <td className="px-3 py-2 text-gray-600" dir="ltr">{Number(item.unit_price).toLocaleString('fa-IR')}</td>
                        <td className="px-3 py-2 text-gray-700 font-medium" dir="ltr">{Math.round(lineTotal).toLocaleString('fa-IR')}</td>
                        <td className="px-3 py-2"><button onClick={() => removeItem(idx)} className="p-1 rounded text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Field label="تخفیف کل (تومان)">
              <input type="number" value={discountAmount || ''} onChange={e => setDiscountAmount(Number(e.target.value))} min="0" dir="ltr" className="modal-input text-sm" />
            </Field>
            <Field label="نرخ مالیات (%)">
              <input type="number" value={taxRate || ''} onChange={e => setTaxRate(Number(e.target.value))} min="0" max="100" dir="ltr" className="modal-input text-sm" />
            </Field>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <div className="text-left space-y-1 text-sm">
              <div className="text-gray-500">جمع کل: <span className="font-bold text-gray-800" dir="ltr">{Math.round(total).toLocaleString('fa-IR')}</span> تومان</div>
            </div>
          </div>
        </div>

        <Field label="توضیحات">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="modal-input" placeholder="اختیاری" />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ثبت سفارش</span>
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// View PO Modal (with receive functionality)
// ============================================================
function ViewPOModal({ order, onClose, onChanged }: {
  order: PurchaseOrder;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const { profile } = useAuth();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('purchase_order_items')
      .select(`*, products!purchase_order_items_product_id_fkey ( name ), units ( name, symbol )`)
      .eq('po_id', order.id);
    setItems((data as POItem[]) || []);
    setLoading(false);
  }, [order.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSend = async () => {
    const { error } = await supabase.from('purchase_orders').update({ status: 'sent' }).eq('id', order.id);
    if (error) alert('خطا: ' + error.message);
    else onChanged();
  };

  const handleReceive = async () => {
    setReceiving(true);
    let allFullyReceived = true;

    for (const item of items) {
      const recvQty = receiveQtys[item.id] ?? 0;
      if (recvQty <= 0) continue;

      const newReceivedQty = Number(item.received_quantity) + recvQty;
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .update({ received_quantity: newReceivedQty })
        .eq('id', item.id);

      if (itemError) { alert('خطا در به‌روزرسانی قلم: ' + itemError.message); setReceiving(false); return; }

      const { error: movError } = await supabase.from('stock_movements').insert({
        product_id: item.product_id,
        movement_type: 'purchase',
        quantity: recvQty,
        unit_id: item.unit_id,
        reference_type: 'purchase_order',
        reference_id: order.id,
        notes: `دریافت از سفارش ${order.po_number}`,
        created_by: profile?.id || null,
      });

      if (movError) { alert('خطا در ثبت حرکت انبار: ' + movError.message); setReceiving(false); return; }

      if (newReceivedQty < Number(item.quantity)) allFullyReceived = false;
    }

    const newStatus = allFullyReceived ? 'received' : 'partially_received';
    const updatePayload: any = { status: newStatus };
    if (allFullyReceived) updatePayload.received_date = new Date().toISOString();

    const { error: poError } = await supabase.from('purchase_orders').update(updatePayload).eq('id', order.id);
    if (poError) alert('خطا در به‌روزرسانی سفارش: ' + poError.message);

    setReceiving(false);
    onChanged();
  };

  const canReceive = order.status === 'sent' || order.status === 'partially_received';

  return (
    <Modal onClose={onClose} title={`سفارش خرید ${order.po_number}`} wide>
      <div className="space-y-4">
        {/* Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50/50 rounded-xl p-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">تأمین‌کننده</p>
            <p className="text-sm font-medium text-gray-700">{order.suppliers?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">تاریخ سفارش</p>
            <p className="text-sm font-medium text-gray-700">{new Date(order.order_date).toLocaleDateString('fa-IR')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">وضعیت</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
          </div>
        </div>

        {/* Items */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-2">محصول</th>
                  <th className="text-right font-medium px-4 py-2">مقدار سفارش</th>
                  <th className="text-right font-medium px-4 py-2">قیمت واحد</th>
                  <th className="text-right font-medium px-4 py-2">دریافت شده</th>
                  {canReceive && <th className="text-right font-medium px-4 py-2">دریافت جدید</th>}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-gray-700">{item.products?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600" dir="ltr">{Number(item.quantity).toLocaleString('fa-IR')} {item.units?.symbol || ''}</td>
                    <td className="px-4 py-2.5 text-gray-600" dir="ltr">{Number(item.unit_price).toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-2.5">
                      <span className={Number(item.received_quantity) >= Number(item.quantity) ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'} dir="ltr">
                        {Number(item.received_quantity).toLocaleString('fa-IR')}
                      </span>
                    </td>
                    {canReceive && (
                      <td className="px-4 py-2.5">
                        <input type="number" value={receiveQtys[item.id] ?? ''} onChange={e => setReceiveQtys({ ...receiveQtys, [item.id]: Number(e.target.value) })}
                          max={Number(item.quantity) - Number(item.received_quantity)} min="0" dir="ltr"
                          className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none focus:border-amber-400" placeholder="0" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="text-left space-y-1 text-sm">
            <div className="text-gray-500">جمع کل: <span className="font-bold text-gray-800" dir="ltr">{Number(order.total_amount).toLocaleString('fa-IR')}</span> تومان</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
          {order.status === 'draft' && (
            <button onClick={handleSend}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600">
              <ArrowRight className="w-4 h-4" /><span>ارسال به تأمین‌کننده</span>
            </button>
          )}
          {canReceive && (
            <button onClick={handleReceive} disabled={receiving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60">
              {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}<span>ثبت دریافت</span>
            </button>
          )}
          {order.status === 'received' && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5" /><span>این سفارش به‌طور کامل دریافت شده است</span>
            </div>
          )}
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 mr-auto">بستن</button>
        </div>
      </div>
    </Modal>
  );
}
