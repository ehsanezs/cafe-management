import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Loader2, X,
  CreditCard, Banknote, Wallet, CheckCircle2, AlertCircle,
  UtensilsCrossed, Package, ArrowRight, Receipt, Smartphone, BookOpen
} from 'lucide-react';

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  sale_price: number;
  image_url: string | null;
  category_id: string | null;
  product_type: string;
  is_active: boolean;
};
type RestaurantTable = { id: string; table_number: string; section: string; capacity: number; status: string };
type CustomerGroup = { id: string; name: string; discount_percent: number };
type Customer = { id: string; full_name: string; phone: string | null; ledger_balance: number; group_id: string | null };

type CartItem = {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  notes?: string;
};

type Order = {
  id: string;
  order_number: string;
  table_id: string | null;
  order_type: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  restaurant_tables?: { table_number: string } | null;
  order_items?: OrderItemRow[];
};

type OrderItemRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string;
  notes: string | null;
  products?: { name: string } | null;
};

const orderTypeLabels: Record<string, string> = {
  dine_in: 'سالن',
  takeaway: 'بیرون‌بر',
  delivery: 'ارسال',
};

const statusLabels: Record<string, string> = {
  open: 'باز',
  sent: 'ارسال شده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده',
  served: 'سرو شده',
  paid: 'پرداخت شده',
  cancelled: 'لغو شده',
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-50 text-blue-600',
  sent: 'bg-indigo-50 text-indigo-600',
  preparing: 'bg-amber-50 text-amber-600',
  ready: 'bg-emerald-50 text-emerald-600',
  served: 'bg-teal-50 text-teal-600',
  paid: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
};

const paymentMethods = [
  { key: 'cash', label: 'نقدی', icon: Banknote },
  { key: 'pos', label: 'کارتخوان PoS', icon: CreditCard },
  { key: 'card_transfer', label: 'کارت به کارت', icon: Smartphone },
  { key: 'online', label: 'آنلاین', icon: Wallet },
  { key: 'wallet', label: 'کیف پول', icon: Wallet },
  { key: 'ledger', label: 'حساب دفتری', icon: BookOpen },
] as const;

export function POSPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [showOrders, setShowOrders] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order');
      setCategories((cats as Category[]) || []);
    })();
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('id, name, sale_price, image_url, category_id, product_type, is_active')
      .eq('is_active', true)
      .in('product_type', ['finished', 'semi_finished'])
      .order('name');
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, []);

  const fetchTables = useCallback(async () => {
    const { data } = await supabase
      .from('restaurant_tables')
      .select('id, table_number, section, capacity, status')
      .order('table_number');
    setTables((data as RestaurantTable[]) || []);
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, restaurant_tables ( table_number )`)
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentOrders((data as Order[]) || []);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchTables(); fetchRecentOrders(); }, [fetchTables, fetchRecentOrders]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== 'all') result = result.filter(p => p.category_id === activeCategory);
    if (search.trim()) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [products, activeCategory, search]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product_id: product.id, name: product.name, unit_price: Number(product.sale_price) || 0, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => c.product_id === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product_id !== productId));

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)]">
      {/* Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی محصول..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all" />
          </div>
          <button onClick={() => { fetchRecentOrders(); setShowOrders(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
            <Receipt className="w-4 h-4" /><span>سفارش‌ها</span>
          </button>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-gradient-to-l from-amber-500 to-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              همه
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeCategory === c.id ? 'bg-gradient-to-l from-amber-500 to-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">محصولی یافت نشد</p>
            <p className="text-xs text-gray-300 mt-1">ابتدا در بخش محصولات، محصول با نوع «محصول نهایی» یا «نیمه‌آماده» ثبت کنید</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto pb-4">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="bg-white rounded-2xl border border-gray-100 p-4 text-right hover:shadow-md hover:border-amber-200 transition-all group">
                <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center mb-3 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-8 h-8 text-amber-300 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <h4 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">{p.name}</h4>
                <p className="text-sm font-bold text-amber-600" dir="ltr">{Number(p.sale_price || 0).toLocaleString('fa-IR')} ت</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart Sidebar (desktop) */}
      <div className="hidden lg:flex w-80 bg-white rounded-2xl border border-gray-100 flex-col">
        <CartContent
          cart={cart}
          orderType={orderType}
          setOrderType={setOrderType}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          tables={tables}
          subtotal={subtotal}
          updateQty={updateQty}
          removeFromCart={removeFromCart}
          onCheckout={() => setShowCheckout(true)}
          profile={profile}
          onOrderCreated={() => { setCart([]); fetchRecentOrders(); }}
        />
      </div>

      {/* Cart FAB (mobile) */}
      <button onClick={() => setCartOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-30 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-l from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-200">
        <ShoppingCart className="w-5 h-5" />
        <span className="text-sm font-semibold">{cartCount} مورد</span>
        {subtotal > 0 && <span className="text-xs opacity-90" dir="ltr">{Math.round(subtotal).toLocaleString('fa-IR')} ت</span>}
      </button>

      {/* Mobile Cart Drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-80 max-w-[85vw] bg-white rounded-r-2xl shadow-2xl flex flex-col mr-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <h3 className="font-bold text-gray-800">سبد سفارش</h3>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
            </div>
            <CartContent
              cart={cart}
              orderType={orderType}
              setOrderType={setOrderType}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
              tables={tables}
              subtotal={subtotal}
              updateQty={updateQty}
              removeFromCart={removeFromCart}
              onCheckout={() => { setCartOpen(false); setShowCheckout(true); }}
              profile={profile}
              onOrderCreated={() => { setCart([]); setCartOpen(false); fetchRecentOrders(); }}
            />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          orderType={orderType}
          selectedTable={selectedTable}
          profile={profile}
          subtotal={subtotal}
          onClose={() => setShowCheckout(false)}
          onCompleted={() => { setCart([]); setShowCheckout(false); fetchRecentOrders(); }}
        />
      )}

      {/* Recent Orders Modal */}
      {showOrders && (
        <RecentOrdersModal
          orders={recentOrders}
          onClose={() => setShowOrders(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Cart Content (shared between desktop sidebar and mobile drawer)
// ============================================================
function CartContent({ cart, orderType, setOrderType, selectedTable, setSelectedTable, tables, subtotal, updateQty, removeFromCart, onCheckout }: {
  cart: CartItem[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  setOrderType: (t: 'dine_in' | 'takeaway' | 'delivery') => void;
  selectedTable: string;
  setSelectedTable: (t: string) => void;
  tables: RestaurantTable[];
  subtotal: number;
  updateQty: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  onCheckout: () => void;
  profile: any;
  onOrderCreated: () => void;
}) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-50">
        <h3 className="font-bold text-gray-800 mb-3">سبد سفارش</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {(['dine_in', 'takeaway', 'delivery'] as const).map(t => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${orderType === t ? 'bg-amber-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              {orderTypeLabels[t]}
            </button>
          ))}
        </div>
        {orderType === 'dine_in' && (
          <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)}
            className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-amber-400">
            <option value="">انتخاب میز...</option>
            {tables.filter(t => t.status === 'available' || t.status === 'occupied').map(t => (
              <option key={t.id} value={t.id}>میز {t.table_number} ({t.section}) — {t.status === 'occupied' ? 'اشغال شده' : 'آزاد'}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="w-10 h-10 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">سبد خالی است</p>
            <p className="text-xs text-gray-300 mt-1">محصولات را از منو انتخاب کنید</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.product_id} className="flex items-center gap-2 bg-gray-50/50 rounded-xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-400" dir="ltr">{Number(item.unit_price).toLocaleString('fa-IR')} ت</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="text-sm font-semibold text-gray-700 w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeFromCart(item.product_id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-gray-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">جمع کل</span>
            <span className="text-lg font-bold text-gray-800" dir="ltr">{Math.round(subtotal).toLocaleString('fa-IR')} ت</span>
          </div>
          <button onClick={onCheckout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all">
            <ArrowRight className="w-4 h-4" /><span>ثبت و پرداخت</span>
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================
// Checkout Modal
// ============================================================
function CheckoutModal({ cart, orderType, selectedTable, profile, subtotal, onClose, onCompleted }: {
  cart: CartItem[];
  orderType: string;
  selectedTable: string;
  profile: any;
  subtotal: number;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [packagingCost, setPackagingCost] = useState(0);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos' | 'card_transfer' | 'online' | 'wallet' | 'ledger'>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: groups }, { data: custs }] = await Promise.all([
        supabase.from('customer_groups').select('id, name, discount_percent').eq('is_active', true).order('name'),
        supabase.from('customers').select('id, full_name, phone, ledger_balance, group_id').eq('is_active', true).order('full_name'),
      ]);
      setCustomerGroups((groups as CustomerGroup[]) || []);
      setCustomers((custs as Customer[]) || []);
    })();
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedGroup = customerGroups.find(g => g.id === selectedGroupId);

  const groupDiscount = selectedGroup ? Math.round(subtotal * Number(selectedGroup.discount_percent) / 100) : 0;
  const effectiveDiscount = Math.max(discountAmount, groupDiscount);
  const afterDiscount = Math.max(0, subtotal - effectiveDiscount);
  const taxAmount = Math.round(afterDiscount * taxRate / 100);
  const total = afterDiscount + taxAmount + Number(packagingCost) + Number(deliveryCost);

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (id) {
      const c = customers.find(c => c.id === id);
      if (c) {
        setCustomerName(c.full_name);
        setCustomerPhone(c.phone || '');
        if (c.group_id) setSelectedGroupId(c.group_id);
      }
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    if (orderType === 'dine_in' && !selectedTable) {
      setError('برای سفارش سالن، انتخاب میز الزامی است');
      setSaving(false);
      return;
    }
    if (cart.length === 0) { setError('سبد خالی است'); setSaving(false); return; }

    if (paymentMethod === 'ledger') {
      if (!selectedCustomerId) {
        setError('برای پرداخت «حساب دفتری» باید یک مشتری ثبت‌شده انتخاب کنید');
        setSaving(false);
        return;
      }
      const newBalance = Number(selectedCustomer?.ledger_balance || 0) + total;
      if (newBalance > 50000000) {
        setError(`موجودی حساب دفتری این مشتری بیش از حد مجاز خواهد شد. موجودی فعلی: ${Number(selectedCustomer?.ledger_balance || 0).toLocaleString('fa-IR')} تومان`);
        setSaving(false);
        return;
      }
    }

    const { data: seqData, error: seqError } = await supabase.rpc('next_number', {
      p_sequence_key: 'order',
    });
    if (seqError) { setError('خطا در تولید شماره سفارش: ' + seqError.message); setSaving(false); return; }

    const orderNumber = seqData as string;

    const { data: orderData, error: orderError } = await supabase.from('orders').insert({
      order_number: orderNumber,
      table_id: orderType === 'dine_in' ? selectedTable : null,
      order_type: orderType,
      status: 'sent',
      subtotal,
      discount_amount: effectiveDiscount,
      tax_amount: taxAmount,
      total_amount: total,
      packaging_cost: Number(packagingCost),
      delivery_cost: Number(deliveryCost),
      customer_id: selectedCustomerId || null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_group_id: selectedGroupId || null,
      notes: notes || null,
      created_by: profile?.id || null,
    }).select('id').single();

    if (orderError) { setError(orderError.message); setSaving(false); return; }

    const itemInserts = cart.map(item => ({
      order_id: orderData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.unit_price * item.quantity,
      status: 'sent',
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemInserts);
    if (itemsError) { setError(itemsError.message); setSaving(false); return; }

    const { error: payError } = await supabase.from('payments').insert({
      order_id: orderData.id,
      amount: total,
      payment_method: paymentMethod,
      status: 'completed',
      created_by: profile?.id || null,
    });
    if (payError) { setError(payError.message); setSaving(false); return; }

    const { error: orderStatusError } = await supabase.from('orders').update({ status: 'paid' }).eq('id', orderData.id);
    if (orderStatusError) { console.error('Failed to mark order as paid:', orderStatusError); }

    if (paymentMethod === 'ledger' && selectedCustomerId) {
      const newBalance = Number(selectedCustomer?.ledger_balance || 0) + total;
      await supabase.from('customers').update({ ledger_balance: newBalance }).eq('id', selectedCustomerId);
    }

    if (orderType === 'dine_in' && selectedTable) {
      await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', selectedTable);
    }

    setSuccess(true);
    setTimeout(() => onCompleted(), 1500);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onCompleted}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">سفارش ثبت شد!</h3>
          <p className="text-sm text-gray-400">سفارش با موفقیت ثبت و پرداخت شد</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">پرداخت سفارش</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

          {/* Customer Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">اطلاعات مشتری</h4>
            <div>
              <label className="block text-xs text-gray-500 mb-1">انتخاب مشتری ثبت‌شده (برای حساب دفتری الزامی است)</label>
              <select value={selectedCustomerId} onChange={e => handleSelectCustomer(e.target.value)}
                className="modal-input">
                <option value="">مشتری بدون ثبت (متفرقه)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}{c.phone ? ` — ${c.phone}` : ''}{Number(c.ledger_balance) > 0 ? ` (دفتری: ${Number(c.ledger_balance).toLocaleString('fa-IR')} ت)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">نام مشتری</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="modal-input" placeholder="نام و نام خانوادگی" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">شماره موبایل</label>
                <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                  dir="ltr" className="modal-input" placeholder="09xxxxxxxxx" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">گروه مشتری</label>
              <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}
                className="modal-input">
                <option value="">بدون گروه</option>
                {customerGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({Number(g.discount_percent)}% تخفیف)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">جمع اقلام</span><span className="text-gray-700" dir="ltr">{Math.round(subtotal).toLocaleString('fa-IR')} ت</span></div>
            {groupDiscount > 0 && (
              <div className="flex justify-between text-sm"><span className="text-gray-500">تخفیف گروه</span><span className="text-emerald-600" dir="ltr">- {groupDiscount.toLocaleString('fa-IR')} ت</span></div>
            )}
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-500">تخفیف اضافی</span>
              <input type="number" value={discountAmount || ''} onChange={e => setDiscountAmount(Number(e.target.value))} min="0" dir="ltr"
                className="w-28 px-2 py-1 rounded-lg border border-gray-200 text-sm text-left outline-none focus:border-amber-400" placeholder="0" />
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-500">مالیات (%)</span>
              <input type="number" value={taxRate || ''} onChange={e => setTaxRate(Number(e.target.value))} min="0" max="100" dir="ltr"
                className="w-28 px-2 py-1 rounded-lg border border-gray-200 text-sm text-left outline-none focus:border-amber-400" placeholder="0" />
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-500">هزینه بسته‌بندی</span>
              <input type="number" value={packagingCost || ''} onChange={e => setPackagingCost(Number(e.target.value))} min="0" dir="ltr"
                className="w-28 px-2 py-1 rounded-lg border border-gray-200 text-sm text-left outline-none focus:border-amber-400" placeholder="0" />
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-500">هزینه ارسال</span>
              <input type="number" value={deliveryCost || ''} onChange={e => setDeliveryCost(Number(e.target.value))} min="0" dir="ltr"
                className="w-28 px-2 py-1 rounded-lg border border-gray-200 text-sm text-left outline-none focus:border-amber-400" placeholder="0" />
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between">
              <span className="font-semibold text-gray-700">مبلغ نهایی</span>
              <span className="font-bold text-lg text-amber-600" dir="ltr">{Math.round(total).toLocaleString('fa-IR')} ت</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">روش پرداخت</label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(m => {
                const Icon = m.icon;
                const isLedgerDisabled = m.key === 'ledger' && !selectedCustomerId;
                return (
                  <button key={m.key} onClick={() => !isLedgerDisabled && setPaymentMethod(m.key)}
                    disabled={isLedgerDisabled}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${paymentMethod === m.key ? 'border-amber-400 bg-amber-50 text-amber-600' : isLedgerDisabled ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Icon className="w-5 h-5" /><span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>
            {paymentMethod === 'ledger' && selectedCustomer && (
              <p className="text-xs text-amber-600 mt-2">
                موجودی فعلی حساب دفتری: <span dir="ltr">{Number(selectedCustomer.ledger_balance).toLocaleString('fa-IR')} ت</span>
                {' — '}پس از این سفارش: <span dir="ltr">{(Number(selectedCustomer.ledger_balance) + total).toLocaleString('fa-IR')} ت</span>
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="modal-input" placeholder="اختیاری" />
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>{saving ? 'در حال ثبت...' : 'ثبت سفارش و پرداخت'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Recent Orders Modal
// ============================================================
function RecentOrdersModal({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">سفارش‌های اخیر</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">سفارشی ثبت نشده است</div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between bg-gray-50/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800" dir="ltr">{o.order_number}</p>
                      <p className="text-xs text-gray-400">
                        {orderTypeLabels[o.order_type] || o.order_type}
                        {o.restaurant_tables?.table_number && ` — میز ${o.restaurant_tables.table_number}`}
                        {' — '}{new Date(o.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-700" dir="ltr">{Number(o.total_amount).toLocaleString('fa-IR')} ت</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[o.status] || 'bg-gray-50 text-gray-500'}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
