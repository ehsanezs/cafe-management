import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Edit3, Trash2, X, Loader2, Save, AlertCircle,
  Users, Phone, Mail, MapPin, Star, Gift, TrendingUp, Calendar
} from 'lucide-react';

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
  loyalty_points: number;
  total_visits: number;
  total_spent: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (!error) setCustomers((data as Customer[]) || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این مشتری مطمئن هستید؟')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
    else fetchCustomers();
  };

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.is_active).length;
  const totalLoyaltyPoints = customers.reduce((s, c) => s + c.loyalty_points, 0);
  const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent), 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="کل مشتریان" value={totalCustomers.toLocaleString('fa-IR')} color="#3b82f6" bg="bg-blue-50" />
        <StatCard icon={Users} label="مشتریان فعال" value={activeCustomers.toLocaleString('fa-IR')} color="#10b981" bg="bg-emerald-50" />
        <StatCard icon={Star} label="امتیازات وفاداری" value={totalLoyaltyPoints.toLocaleString('fa-IR')} color="#f59e0b" bg="bg-amber-50" />
        <StatCard icon={TrendingUp} label="مجموع خرید" value={Math.round(totalSpent).toLocaleString('fa-IR') + ' ت'} color="#8b5cf6" bg="bg-violet-50" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو نام، تلفن، ایمیل..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all" />
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap">
          <Plus className="w-4 h-4" /><span>مشتری جدید</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">هنوز مشتری‌ای ثبت نشده است</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {c.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{c.full_name}</h3>
                    {c.phone && <p className="text-xs text-gray-400" dir="ltr">{c.phone}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${c.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                  {c.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500">
                {c.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-300" /><span dir="ltr">{c.email}</span></div>}
                {c.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-300" /><span className="line-clamp-1">{c.address}</span></div>}
                {c.birth_date && <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-300" /><span>{new Date(c.birth_date).toLocaleDateString('fa-IR')}</span></div>}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <p className="text-xs text-gray-400">امتیاز</p>
                  <p className="text-sm font-bold text-amber-600 flex items-center justify-center gap-1"><Star className="w-3 h-3" />{c.loyalty_points.toLocaleString('fa-IR')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">بازدید</p>
                  <p className="text-sm font-bold text-gray-700">{c.total_visits.toLocaleString('fa-IR')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">خرج کرده</p>
                  <p className="text-sm font-bold text-gray-700" dir="ltr">{Math.round(Number(c.total_spent)).toLocaleString('fa-IR')}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => { setEditing(c); setShowModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /><span>ویرایش</span>
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /><span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CustomerModal
          customer={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchCustomers(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: typeof Users; label: string; value: string; color: string; bg: string }) {
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

function CustomerModal({ customer, onClose, onSaved }: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    birth_date: customer?.birth_date ? customer.birth_date.slice(0, 10) : '',
    loyalty_points: customer?.loyalty_points ?? 0,
    is_active: customer?.is_active ?? true,
    notes: customer?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      birth_date: form.birth_date || null,
      notes: form.notes || null,
    };
    const { error: err } = customer
      ? await supabase.from('customers').update(payload).eq('id', customer.id)
      : await supabase.from('customers').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">{customer ? 'ویرایش مشتری' : 'مشتری جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام و نام خانوادگی <span className="text-red-400">*</span></label>
            <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required className="modal-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تلفن</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" className="modal-input" placeholder="09xxxxxxxxx" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ایمیل</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" className="modal-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">آدرس</label>
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="modal-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ تولد</label>
              <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} dir="ltr" className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">امتیاز وفاداری</label>
              <input type="number" value={form.loyalty_points} onChange={e => setForm({ ...form, loyalty_points: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">یادداشت</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="modal-input" placeholder="اختیاری" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-gray-600">فعال</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>{customer ? 'ذخیره' : 'ایجاد'}</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
