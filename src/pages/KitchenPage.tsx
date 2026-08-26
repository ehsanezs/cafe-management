import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2, RefreshCw, Clock, CheckCircle2, ChefHat, AlertCircle,
  Flame, UtensilsCrossed, X
} from 'lucide-react';

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

type KitchenOrder = {
  id: string;
  order_number: string;
  branch_id: string | null;
  table_id: string | null;
  order_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  restaurant_tables?: { table_number: string } | null;
  order_items?: OrderItemRow[];
};

const itemStatusLabels: Record<string, string> = {
  pending: 'در انتظار',
  sent: 'ارسال شده',
  preparing: 'در حال پخت',
  ready: 'آماده',
  served: 'سرو شده',
  cancelled: 'لغو شده',
};

const itemStatusColors: Record<string, string> = {
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
  sent: 'bg-blue-50 text-blue-600 border-blue-200',
  preparing: 'bg-amber-50 text-amber-600 border-amber-200',
  ready: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  served: 'bg-gray-100 text-gray-400 border-gray-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const orderTypeLabels: Record<string, string> = {
  dine_in: 'سالن',
  takeaway: 'بیرون‌بر',
  delivery: 'ارسال',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff} ثانیه`;
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه`;
  return `${Math.floor(diff / 3600)} ساعت`;
}

export function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'incoming' | 'preparing' | 'ready'>('incoming');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant_tables ( table_number ),
        order_items!order_items_order_id_fkey (
          id, product_id, quantity, unit_price, line_total, status, notes,
          products!order_items_product_id_fkey ( name )
        )
      `)
      .in('status', ['sent', 'preparing', 'ready'])
      .order('created_at', { ascending: true });
    setOrders((data as KitchenOrder[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateItemStatus = async (itemId: string, newStatus: string, order: KitchenOrder) => {
    const { error } = await supabase.from('order_items').update({ status: newStatus }).eq('id', itemId);
    if (error) { alert('خطا: ' + error.message); return; }

    const allItems = order.order_items || [];
    const otherItems = allItems.filter(i => i.id !== itemId);
    const allReady = otherItems.every(i => i.status === 'ready' || i.status === 'served' || i.status === 'cancelled');
    const allPreparing = otherItems.every(i => i.status === 'preparing' || i.status === 'ready' || i.status === 'served' || i.status === 'cancelled');

    let newOrderStatus = order.status;
    if (newStatus === 'preparing') newOrderStatus = 'preparing';
    else if (newStatus === 'ready' && allReady) newOrderStatus = 'ready';
    else if (newStatus === 'served') {
      const allServed = allItems.every(i => i.status === 'served' || i.status === 'cancelled' || i.id === itemId);
      if (allServed) newOrderStatus = 'served';
    }

    if (newOrderStatus !== order.status) {
      await supabase.from('orders').update({ status: newOrderStatus }).eq('id', order.id);
    }
    fetchOrders();
  };

  const incomingOrders = orders.filter(o => o.status === 'sent' || (o.order_items || []).some(i => i.status === 'sent'));
  const preparingOrders = orders.filter(o => o.status === 'preparing' || (o.order_items || []).some(i => i.status === 'preparing'));
  const readyOrders = orders.filter(o => o.status === 'ready' || (o.order_items || []).some(i => i.status === 'ready'));

  const tabOrders = activeTab === 'incoming' ? incomingOrders : activeTab === 'preparing' ? preparingOrders : readyOrders;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /><span>بروزرسانی</span>
        </button>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {([
            { key: 'incoming', label: 'ورودی', count: incomingOrders.length, icon: Clock },
            { key: 'preparing', label: 'در حال پخت', count: preparingOrders.length, icon: Flame },
            { key: 'ready', label: 'آماده', count: readyOrders.length, icon: CheckCircle2 },
          ] as const).map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20' : 'bg-amber-100 text-amber-600'}`}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : tabOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <ChefHat className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {activeTab === 'incoming' ? 'سفارش جدیدی در انتظار نیست' : activeTab === 'preparing' ? 'هیچ سفارشی در حال پخت نیست' : 'هیچ سفارش آماده‌ای وجود ندارد'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tabOrders.map(order => (
            <KitchenOrderCard key={order.id} order={order} onUpdateItem={updateItemStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Kitchen Order Card
// ============================================================
function KitchenOrderCard({ order, onUpdateItem }: {
  order: KitchenOrder;
  onUpdateItem: (itemId: string, newStatus: string, order: KitchenOrder) => void;
}) {
  const items = order.order_items || [];
  const elapsed = timeAgo(order.created_at);
  const isUrgent = Date.now() - new Date(order.created_at).getTime() > 15 * 60 * 1000;

  return (
    <div className={`bg-white rounded-2xl border-2 p-4 ${isUrgent ? 'border-red-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isUrgent ? 'bg-red-50' : 'bg-amber-50'}`}>
            <UtensilsCrossed className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800" dir="ltr">{order.order_number}</p>
            <p className="text-xs text-gray-400">
              {orderTypeLabels[order.order_type] || order.order_type}
              {order.restaurant_tables?.table_number && ` — میز ${order.restaurant_tables.table_number}`}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
          <Clock className="w-3.5 h-3.5" /><span>{elapsed}</span>
        </div>
      </div>

      {order.notes && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {order.notes}
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {items.filter(i => i.status !== 'cancelled' && i.status !== 'served').map(item => (
          <div key={item.id} className={`rounded-xl border p-3 ${itemStatusColors[item.status] || 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">{item.quantity}×</span>
                <span className="text-sm font-medium text-gray-700">{item.products?.name || '—'}</span>
              </div>
              <span className="text-xs font-medium">{itemStatusLabels[item.status] || item.status}</span>
            </div>
            {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
            <div className="flex items-center gap-1 mt-2">
              {item.status === 'sent' && (
                <button onClick={() => onUpdateItem(item.id, 'preparing', order)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors">
                  <Flame className="w-3.5 h-3.5" /><span>شروع پخت</span>
                </button>
              )}
              {item.status === 'preparing' && (
                <button onClick={() => onUpdateItem(item.id, 'ready', order)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /><span>آماده شد</span>
                </button>
              )}
              {item.status === 'ready' && (
                <button onClick={() => onUpdateItem(item.id, 'served', order)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /><span>سرو شد</span>
                </button>
              )}
              <button onClick={() => onUpdateItem(item.id, 'cancelled', order)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 text-xs font-medium hover:bg-red-50 hover:text-red-600 transition-colors">
                <X className="w-3.5 h-3.5" /><span>لغو</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Served/Cancelled items summary */}
      {items.some(i => i.status === 'served' || i.status === 'cancelled') && (
        <div className="mt-2 pt-2 border-t border-gray-50 text-xs text-gray-400">
          {items.filter(i => i.status === 'served').length} سرو شده
          {items.some(i => i.status === 'cancelled') && ` — ${items.filter(i => i.status === 'cancelled').length} لغو شده`}
        </div>
      )}
    </div>
  );
}
