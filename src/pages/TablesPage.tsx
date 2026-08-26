import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Plus, Loader2, Users, X, Save, AlertCircle, Edit3, Trash2,
  LayoutGrid, RefreshCw
} from 'lucide-react';

type Branch = { id: string; name: string };
type RestaurantTable = {
  id: string;
  branch_id: string;
  table_number: string;
  section: string;
  capacity: number;
  status: string;
  x_pos: number;
  y_pos: number;
};

const statusLabels: Record<string, string> = {
  available: 'آزاد',
  occupied: 'اشغال شده',
  reserved: 'رزرو شده',
  cleaning: 'در حال پاک‌سازی',
};

const statusColors: Record<string, string> = {
  available: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  occupied: 'bg-red-50 border-red-200 text-red-700',
  reserved: 'bg-amber-50 border-amber-200 text-amber-700',
  cleaning: 'bg-blue-50 border-blue-200 text-blue-700',
};

const statusDot: Record<string, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-red-500',
  reserved: 'bg-amber-500',
  cleaning: 'bg-blue-500',
};

export function TablesPage() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(profile?.default_branch_id || '');
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'floor'>('grid');

  useEffect(() => {
    (async () => {
      const { data: brs } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
      const branchesData = (brs as Branch[]) || [];
      setBranches(branchesData);
      if (!branchId && branchesData.length > 0) setBranchId(branchesData[0].id);
    })();
  }, []);

  const fetchTables = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const { data } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('branch_id', branchId)
      .order('table_number');
    setTables((data as RestaurantTable[]) || []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  const handleStatusChange = async (tableId: string, newStatus: string) => {
    const { error } = await supabase.from('restaurant_tables').update({ status: newStatus }).eq('id', tableId);
    if (error) alert('خطا: ' + error.message);
    else fetchTables();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این میز مطمئن هستید؟')) return;
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
    else fetchTables();
  };

  const sections = [...new Set(tables.map(t => t.section))];
  const statusCounts = {
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    cleaning: tables.filter(t => t.status === 'cleaning').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(statusLabels) as string[]).map(s => (
          <div key={s} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusDot[s]}`} />
            <div>
              <p className="text-2xl font-bold text-gray-800">{statusCounts[s as keyof typeof statusCounts]}</p>
              <p className="text-xs text-gray-400">{statusLabels[s]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          <button onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'grid' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('floor')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'floor' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              نقشه سالن
            </button>
        </div>
        <button onClick={fetchTables}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
          <RefreshCw className="w-4 h-4" /><span>بروزرسانی</span>
        </button>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap">
          <Plus className="w-4 h-4" /><span>میز جدید</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : tables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <LayoutGrid className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">هنوز میزی تعریف نشده است</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">{section}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {tables.filter(t => t.section === section).map(t => (
                  <div key={t.id} className={`rounded-2xl border-2 p-4 transition-all ${statusColors[t.status] || 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold">{t.table_number}</span>
                      <div className={`w-2.5 h-2.5 rounded-full ${statusDot[t.status]}`} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs opacity-70 mb-3">
                      <Users className="w-3.5 h-3.5" /><span>{t.capacity} نفر</span>
                    </div>
                    <p className="text-xs font-medium mb-2">{statusLabels[t.status] || t.status}</p>
                    <div className="flex items-center gap-1">
                      <select value={t.status} onChange={e => handleStatusChange(t.id, e.target.value)}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-amber-400">
                        {(Object.keys(statusLabels) as string[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                      </select>
                      <button onClick={() => { setEditing(t); setShowModal(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <FloorPlanView tables={tables} onStatusChange={handleStatusChange} />
      )}

      {showModal && (
        <TableModal table={editing} branchId={branchId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchTables(); }} />
      )}
    </div>
  );
}

// ============================================================
// Floor Plan View
// ============================================================
function FloorPlanView({ tables, onStatusChange }: { tables: RestaurantTable[]; onStatusChange: (id: string, status: string) => void }) {
  const maxX = Math.max(...tables.map(t => t.x_pos), 2) + 1;
  const maxY = Math.max(...tables.map(t => t.y_pos), 2) + 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${maxX}, minmax(0, 1fr))` }}>
        {Array.from({ length: maxX * maxY }).map((_, idx) => {
          const x = idx % maxX;
          const y = Math.floor(idx / maxX);
          const table = tables.find(t => t.x_pos === x && t.y_pos === y);
          if (!table) return <div key={idx} className="aspect-square rounded-xl border-2 border-dashed border-gray-100" />;
          return (
            <div key={idx} className={`aspect-square rounded-xl border-2 p-3 flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 ${statusColors[table.status]}`}>
              <span className="text-2xl font-bold mb-1">{table.table_number}</span>
              <Users className="w-4 h-4 opacity-60 mb-1" />
              <span className="text-xs opacity-70">{table.capacity} نفر</span>
              <p className="text-xs font-medium mt-1">{statusLabels[table.status]}</p>
              <select value={table.status} onChange={e => onStatusChange(table.id, e.target.value)}
                className="mt-2 text-xs px-1.5 py-1 rounded-lg border border-gray-200 bg-white outline-none">
                {(Object.keys(statusLabels) as string[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Table Modal (create/edit)
// ============================================================
function TableModal({ table, branchId, onClose, onSaved }: {
  table: RestaurantTable | null;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    table_number: table?.table_number || '',
    section: table?.section || 'سالن اصلی',
    capacity: table?.capacity || 4,
    x_pos: table?.x_pos ?? 0,
    y_pos: table?.y_pos ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, branch_id: branchId };
    const { error: err } = table
      ? await supabase.from('restaurant_tables').update(payload).eq('id', table.id)
      : await supabase.from('restaurant_tables').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{table ? 'ویرایش میز' : 'میز جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">شماره میز <span className="text-red-400">*</span></label>
              <input type="text" value={form.table_number} onChange={e => setForm({ ...form, table_number: e.target.value })} required className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">بخش</label>
              <input type="text" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ظرفیت (نفر)</label>
              <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} min="1" dir="ltr" className="modal-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ستون</label>
                <input type="number" value={form.x_pos} onChange={e => setForm({ ...form, x_pos: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ردیف</label>
                <input type="number" value={form.y_pos} onChange={e => setForm({ ...form, y_pos: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>{table ? 'ذخیره' : 'ایجاد'}</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
