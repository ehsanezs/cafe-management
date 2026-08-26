import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Edit3, Trash2, X, Truck, AlertCircle, Loader2, Save, Phone, Mail, MapPin
} from 'lucide-react';

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  is_active: boolean;
  created_at: string;
};

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('suppliers').select('*').order('name');
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (!error) setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این تأمین‌کننده مطمئن هستید؟')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
    else fetchSuppliers();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی تأمین‌کننده..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>تأمین‌کننده جدید</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <Truck className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">هنوز تأمین‌کننده‌ای ثبت نشده است</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{s.name}</h3>
                    {s.contact_person && <p className="text-xs text-gray-400">{s.contact_person}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                  {s.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                {s.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-300" /><span dir="ltr">{s.phone}</span></div>}
                {s.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-300" /><span dir="ltr">{s.email}</span></div>}
                {s.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-300" /><span className="line-clamp-1">{s.address}</span></div>}
              </div>
              {s.payment_terms && <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">شرایط پرداخت: {s.payment_terms}</div>}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => { setEditing(s); setShowModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /><span>ویرایش</span>
                </button>
                <button onClick={() => handleDelete(s.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /><span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal
          supplier={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchSuppliers(); }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    tax_id: supplier?.tax_id || '',
    payment_terms: supplier?.payment_terms || '',
    is_active: supplier?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, contact_person: form.contact_person || null, phone: form.phone || null, email: form.email || null, address: form.address || null, tax_id: form.tax_id || null, payment_terms: form.payment_terms || null };
    const { error: err } = supplier
      ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      : await supabase.from('suppliers').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <Modal onClose={onClose} title={supplier ? 'ویرایش تأمین‌کننده' : 'تأمین‌کننده جدید'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
        <Field label="نام" required><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="modal-input" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="نام مسئول"><input type="text" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="modal-input" /></Field>
          <Field label="تلفن"><input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} dir="ltr" className="modal-input" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="ایمیل"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} dir="ltr" className="modal-input" /></Field>
          <Field label="کد مالیاتی"><input type="text" value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})} dir="ltr" className="modal-input" /></Field>
        </div>
        <Field label="آدرس"><textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows={2} className="modal-input" /></Field>
        <Field label="شرایط پرداخت"><input type="text" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} className="modal-input" placeholder="مثلاً: ۳۰ روزه" /></Field>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="w-4 h-4 rounded accent-amber-500" /><span className="text-sm text-gray-600">فعال</span></label>
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>{supplier ? 'ذخیره' : 'ایجاد'}</span>
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
        </div>
      </form>
    </Modal>
  );
}

export function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-md'} w-full max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label} {required && <span className="text-red-400">*</span>}</label>
      {children}
    </div>
  );
}
