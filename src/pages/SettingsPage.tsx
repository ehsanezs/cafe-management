import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Settings, Save, Loader2, AlertCircle, Plus, Trash2, Edit3, X,
  Printer, Store, Palette, Share2, Clock, Phone, Mail, MapPin,
  Building2, CheckCircle2, Power
} from 'lucide-react';

type Printer = {
  id: string;
  name: string;
  printer_type: string;
  connection_type: string;
  ip_address: string | null;
  port: number;
  mac_address: string | null;
  is_active: boolean;
  is_default: boolean;
  paper_width: number;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  is_active: boolean;
};

type SettingsData = {
  restaurant_name: string;
  logo_url: string | null;
  brand_color: string;
  dark_mode_enabled: boolean;
  social_instagram: string | null;
  social_telegram: string | null;
  social_whatsapp: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  brand_story: string | null;
  opening_hours: Record<string, string> | null;
};

const dayLabels: Record<string, string> = {
  sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه',
  wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه',
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'printers' | 'warehouses' | 'social'>('general');
  const [settings, setSettings] = useState<SettingsData>({
    restaurant_name: '',
    logo_url: null,
    brand_color: '#f59e0b',
    dark_mode_enabled: false,
    social_instagram: null,
    social_telegram: null,
    social_whatsapp: null,
    contact_phone: null,
    contact_email: null,
    address: null,
    brand_story: null,
    opening_hours: null,
  });
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: settingsData }, { data: printersData }, { data: whData }] = await Promise.all([
      supabase.from('settings').select('*').is('branch_id', null).maybeSingle(),
      supabase.from('printers').select('*').order('name'),
      supabase.from('warehouses').select('*').order('name'),
    ]);
    if (settingsData) {
      setSettings({
        restaurant_name: settingsData.restaurant_name || '',
        logo_url: settingsData.logo_url || null,
        brand_color: settingsData.brand_color || '#f59e0b',
        dark_mode_enabled: settingsData.dark_mode_enabled || false,
        social_instagram: settingsData.social_instagram || null,
        social_telegram: settingsData.social_telegram || null,
        social_whatsapp: settingsData.social_whatsapp || null,
        contact_phone: settingsData.contact_phone || null,
        contact_email: settingsData.contact_email || null,
        address: settingsData.address || null,
        brand_story: settingsData.brand_story || null,
        opening_hours: settingsData.opening_hours || null,
      });
    }
    setPrinters((printersData as Printer[]) || []);
    setWarehouses((whData as Warehouse[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({
      restaurant_name: settings.restaurant_name,
      logo_url: settings.logo_url,
      brand_color: settings.brand_color,
      dark_mode_enabled: settings.dark_mode_enabled,
      social_instagram: settings.social_instagram,
      social_telegram: settings.social_telegram,
      social_whatsapp: settings.social_whatsapp,
      contact_phone: settings.contact_phone,
      contact_email: settings.contact_email,
      address: settings.address,
      brand_story: settings.brand_story,
      opening_hours: settings.opening_hours,
      branch_id: null,
    });
    if (!error) {
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    }
    setSaving(false);
  };

  const handleDeletePrinter = async (id: string) => {
    if (!confirm('حذف این پرینتر؟')) return;
    await supabase.from('printers').delete().eq('id', id);
    fetchAll();
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('حذف این انبار؟')) return;
    await supabase.from('warehouses').delete().eq('id', id);
    fetchAll();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>;
  }

  const tabs = [
    { key: 'general', label: 'اطلاعات کلی', icon: Store },
    { key: 'branding', label: 'برندینگ', icon: Palette },
    { key: 'printers', label: 'پرینترها', icon: Printer },
    { key: 'warehouses', label: 'انبارها', icon: Building2 },
    { key: 'social', label: 'شبکه‌های اجتماعی', icon: Share2 },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /><span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4" /><span>تنظیمات با موفقیت ذخیره شد</span>
        </div>
      )}

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-800">اطلاعات مجموعه</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نام مجموعه</label>
              <input type="text" value={settings.restaurant_name} onChange={e => setSettings({ ...settings, restaurant_name: e.target.value })}
                className="modal-input" placeholder="کافه‌رستوران" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تلفن تماس</label>
              <input type="text" value={settings.contact_phone || ''} onChange={e => setSettings({ ...settings, contact_phone: e.target.value })}
                dir="ltr" className="modal-input" placeholder="021-xxxxxxxx" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ایمیل</label>
              <input type="email" value={settings.contact_email || ''} onChange={e => setSettings({ ...settings, contact_email: e.target.value })}
                dir="ltr" className="modal-input" placeholder="info@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">آدرس</label>
              <input type="text" value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })}
                className="modal-input" placeholder="آدرس مجموعه" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">داستان برند</label>
            <textarea value={settings.brand_story || ''} onChange={e => setSettings({ ...settings, brand_story: e.target.value })}
              rows={3} className="modal-input" placeholder="داستان و بیوگرافی مجموعه شما..." />
          </div>

          {/* Opening Hours */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-semibold text-gray-700">ساعات کاری</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(dayLabels).map(([day, label]) => (
                <div key={day} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-20">{label}</span>
                  <input type="text" value={settings.opening_hours?.[day] || ''}
                    onChange={e => setSettings({ ...settings, opening_hours: { ...settings.opening_hours, [day]: e.target.value } })}
                    dir="ltr" className="modal-input text-sm flex-1" placeholder="09:00-22:00" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
          </button>
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-800">برندینگ و ظاهر</h3>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">آدرس لوگو</label>
            <input type="text" value={settings.logo_url || ''} onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
              dir="ltr" className="modal-input" placeholder="https://..." />
            {settings.logo_url && (
              <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden border border-gray-100">
                <img src={settings.logo_url} alt="logo" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">رنگ سازمانی</label>
            <div className="flex items-center gap-3">
              <input type="color" value={settings.brand_color} onChange={e => setSettings({ ...settings, brand_color: e.target.value })}
                className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer" />
              <input type="text" value={settings.brand_color} onChange={e => setSettings({ ...settings, brand_color: e.target.value })}
                dir="ltr" className="modal-input flex-1" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.dark_mode_enabled} onChange={e => setSettings({ ...settings, dark_mode_enabled: e.target.checked })}
              className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-gray-600">حالت شب (Dark Mode)</span>
          </label>
          <button onClick={handleSaveSettings} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
          </button>
        </div>
      )}

      {/* Printers Tab */}
      {activeTab === 'printers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">مدیریت پرینترهای متصل به سیستم (بدون محدودیت تعداد)</p>
            <button onClick={() => { setEditingPrinter(null); setShowPrinterModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>پرینتر جدید</span>
            </button>
          </div>
          {printers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <Printer className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">هنوز پرینتری ثبت نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {printers.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Printer className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{p.name}</h4>
                        {p.is_default && <span className="text-xs text-amber-600">پیش‌فرض</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                      {p.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div>نوع: {printerTypeLabels[p.printer_type] || p.printer_type}</div>
                    <div>اتصال: {connectionTypeLabels[p.connection_type] || p.connection_type}</div>
                    {p.ip_address && <div dir="ltr">IP: {p.ip_address}:{p.port}</div>}
                    {p.mac_address && <div dir="ltr">MAC: {p.mac_address}</div>}
                    <div>عرض کاغذ: {p.paper_width}mm</div>
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                    <button onClick={() => { setEditingPrinter(p); setShowPrinterModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600">
                      <Edit3 className="w-3.5 h-3.5" /><span>ویرایش</span>
                    </button>
                    <button onClick={() => handleDeletePrinter(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" /><span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warehouses Tab */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">مدیریت انبارهای مختلف (بدون محدودیت)</p>
            <button onClick={() => { setEditingWarehouse(null); setShowWarehouseModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>انبار جدید</span>
            </button>
          </div>
          {warehouses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">هنوز انباری ثبت نشده است</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-gray-400 text-xs">
                    <th className="text-right font-medium px-4 py-3">نام</th>
                    <th className="text-right font-medium px-4 py-3">کد</th>
                    <th className="text-right font-medium px-4 py-3">موقعیت</th>
                    <th className="text-right font-medium px-4 py-3">وضعیت</th>
                    <th className="text-center font-medium px-4 py-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map(w => (
                    <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-700">{w.name}</td>
                      <td className="px-4 py-3 text-gray-500" dir="ltr">{w.code}</td>
                      <td className="px-4 py-3 text-gray-500">{w.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${w.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                          {w.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingWarehouse(w); setShowWarehouseModal(true); }}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteWarehouse(w.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Social Tab */}
      {activeTab === 'social' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-800">شبکه‌های اجتماعی</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اینستاگرام</label>
              <input type="text" value={settings.social_instagram || ''} onChange={e => setSettings({ ...settings, social_instagram: e.target.value })}
                dir="ltr" className="modal-input" placeholder="@your_page" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تلگرام</label>
              <input type="text" value={settings.social_telegram || ''} onChange={e => setSettings({ ...settings, social_telegram: e.target.value })}
                dir="ltr" className="modal-input" placeholder="@your_channel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">واتساپ</label>
              <input type="text" value={settings.social_whatsapp || ''} onChange={e => setSettings({ ...settings, social_whatsapp: e.target.value })}
                dir="ltr" className="modal-input" placeholder="09xxxxxxxxx" />
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
          </button>
        </div>
      )}

      {showPrinterModal && (
        <PrinterModal printer={editingPrinter} onClose={() => setShowPrinterModal(false)} onSaved={() => { setShowPrinterModal(false); fetchAll(); }} />
      )}
      {showWarehouseModal && (
        <WarehouseModal warehouse={editingWarehouse} onClose={() => setShowWarehouseModal(false)} onSaved={() => { setShowWarehouseModal(false); fetchAll(); }} />
      )}
    </div>
  );
}

const printerTypeLabels: Record<string, string> = {
  thermal: 'حرارتی', kitchen: 'آشپزخانه', label: 'برچسب', regular: 'معمولی',
};
const connectionTypeLabels: Record<string, string> = {
  network: 'شبکه', usb: 'USB', bluetooth: 'بلوتوث',
};

function PrinterModal({ printer, onClose, onSaved }: {
  printer: Printer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: printer?.name || '',
    printer_type: printer?.printer_type || 'thermal',
    connection_type: printer?.connection_type || 'network',
    ip_address: printer?.ip_address || '',
    port: printer?.port || 9100,
    mac_address: printer?.mac_address || '',
    is_active: printer?.is_active ?? true,
    is_default: printer?.is_default ?? false,
    paper_width: printer?.paper_width || 80,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      ip_address: form.ip_address || null,
      mac_address: form.mac_address || null,
    };
    let result;
    if (printer) {
      result = await supabase.from('printers').update(payload).eq('id', printer.id);
    } else {
      result = await supabase.from('printers').insert(payload);
    }
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{printer ? 'ویرایش پرینتر' : 'پرینتر جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام پرینتر <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع پرینتر</label>
              <select value={form.printer_type} onChange={e => setForm({ ...form, printer_type: e.target.value })} className="modal-input">
                {Object.entries(printerTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع اتصال</label>
              <select value={form.connection_type} onChange={e => setForm({ ...form, connection_type: e.target.value })} className="modal-input">
                {Object.entries(connectionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {form.connection_type === 'network' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">آدرس IP</label>
                <input type="text" value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} dir="ltr" className="modal-input" placeholder="192.168.1.100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">پورت</label>
                <input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} dir="ltr" className="modal-input" />
              </div>
            </div>
          )}
          {form.connection_type === 'bluetooth' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">MAC Address</label>
              <input type="text" value={form.mac_address} onChange={e => setForm({ ...form, mac_address: e.target.value })} dir="ltr" className="modal-input" placeholder="XX:XX:XX:XX:XX:XX" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">عرض کاغذ (mm)</label>
            <select value={form.paper_width} onChange={e => setForm({ ...form, paper_width: Number(e.target.value) })} className="modal-input">
              <option value={58}>58mm</option>
              <option value={80}>80mm</option>
              <option value={112}>112mm</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm text-gray-600">فعال</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm text-gray-600">پرینتر پیش‌فرض</span>
            </label>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WarehouseModal({ warehouse, onClose, onSaved }: {
  warehouse: Warehouse | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: warehouse?.name || '',
    code: warehouse?.code || '',
    location: warehouse?.location || '',
    is_active: warehouse?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let result;
    if (warehouse) {
      result = await supabase.from('warehouses').update(form).eq('id', warehouse.id);
    } else {
      result = await supabase.from('warehouses').insert(form);
    }
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{warehouse ? 'ویرایش انبار' : 'انبار جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام انبار <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">کد انبار <span className="text-red-400">*</span></label>
            <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required dir="ltr" className="modal-input" placeholder="WH-01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">موقعیت</label>
            <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="modal-input" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-gray-600">فعال</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
