import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Edit3, Trash2, X, Loader2, Save, AlertCircle,
  Users, Phone, Mail, MapPin, Star, Gift, TrendingUp, Calendar,
  Heart, ThumbsDown, AlertTriangle, StickyNote, Send, Megaphone,
  Upload, Download, Tag, CheckCircle2, MessageSquare, Clock
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
  group_id: string | null;
  ledger_balance: number;
  created_at: string;
};

type CustomerGroup = {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  is_active: boolean;
};

type Preference = {
  id: string;
  customer_id: string;
  product_id: string | null;
  preference_type: string;
  preference_value: string | null;
  products?: { name: string } | null;
};

type Campaign = {
  id: string;
  name: string;
  campaign_type: string;
  target_group_id: string | null;
  discount_percent: number;
  credit_amount: number;
  sms_message: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  sent_count: number;
  response_count: number;
  created_at: string;
  customer_groups?: { name: string } | null;
};

type SmsLog = {
  id: string;
  campaign_id: string | null;
  customer_id: string | null;
  phone: string;
  message: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

const prefTypeLabels: Record<string, string> = {
  favorite: 'محبوب',
  dislike: 'نپسندیده',
  allergy: 'حساسیت',
  note: 'یادداشت',
};

const prefTypeIcons: Record<string, typeof Heart> = {
  favorite: Heart,
  dislike: ThumbsDown,
  allergy: AlertTriangle,
  note: StickyNote,
};

const prefTypeColors: Record<string, string> = {
  favorite: 'text-rose-500 bg-rose-50',
  dislike: 'text-gray-500 bg-gray-50',
  allergy: 'text-red-500 bg-red-50',
  note: 'text-blue-500 bg-blue-50',
};

const campaignTypeLabels: Record<string, string> = {
  discount: 'تخفیف',
  credit: 'اعتبار',
  sms: 'پیامک',
  loyalty: 'وفاداری',
};

const campaignStatusLabels: Record<string, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
};

const campaignStatusColors: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-500',
  active: 'bg-emerald-50 text-emerald-600',
  completed: 'bg-blue-50 text-blue-600',
  cancelled: 'bg-red-50 text-red-600',
};

export function CustomersPage() {
  const [activeTab, setActiveTab] = useState<'customers' | 'groups' | 'campaigns' | 'sms'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showPrefModal, setShowPrefModal] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: custData }, { data: grpData }, { data: campData }, { data: smsData }] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('customer_groups').select('*').order('name'),
      supabase.from('campaigns').select('*, customer_groups(name)').order('created_at', { ascending: false }),
      supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setCustomers((custData as Customer[]) || []);
    setGroups((grpData as CustomerGroup[]) || []);
    setCampaigns((campData as Campaign[]) || []);
    setSmsLogs((smsData as SmsLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredCustomers = search.trim()
    ? customers.filter(c =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase()))
    : customers;

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این مشتری مطمئن هستید؟')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
    else fetchAll();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('حذف این گروه؟')) return;
    const { error } = await supabase.from('customer_groups').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
    else fetchAll();
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('حذف این کمپین؟')) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
    else fetchAll();
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { alert('فایل خالی است'); return; }

    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return {
        full_name: cols[0] || '',
        phone: cols[1] || null,
        email: cols[2] || null,
        address: cols[3] || null,
      };
    }).filter(r => r.full_name);

    if (rows.length === 0) { alert('داده معتبری یافت نشد'); return; }

    const { error } = await supabase.from('customers').insert(rows);
    if (error) alert('خطا در ورود داده: ' + error.message);
    else { alert(rows.length + ' مشتری با موفقیت اضافه شد'); fetchAll(); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportCustomers = () => {
    const headers = ['نام', 'تلفن', 'ایمیل', 'آدرس', 'امتیاز', 'بازدید', 'مجموع خرید'];
    const rows = customers.map(c => [
      c.full_name,
      c.phone || '',
      c.email || '',
      (c.address || '').replace(/,/g, '؛'),
      c.loyalty_points,
      c.total_visits,
      Math.round(Number(c.total_spent)),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
  };

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.is_active).length;
  const totalLoyaltyPoints = customers.reduce((s, c) => s + c.loyalty_points, 0);
  const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent), 0);

  const tabs = [
    { key: 'customers', label: 'مشتریان', icon: Users },
    { key: 'groups', label: 'گروه‌بندی', icon: Tag },
    { key: 'campaigns', label: 'کمپین‌ها', icon: Megaphone },
    { key: 'sms', label: 'پیامک‌ها', icon: MessageSquare },
  ] as const;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>;
  }

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

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="کل مشتریان" value={totalCustomers.toLocaleString('fa-IR')} color="#3b82f6" bg="bg-blue-50" />
            <StatCard icon={Users} label="مشتریان فعال" value={activeCustomers.toLocaleString('fa-IR')} color="#10b981" bg="bg-emerald-50" />
            <StatCard icon={Star} label="امتیازات وفاداری" value={totalLoyaltyPoints.toLocaleString('fa-IR')} color="#f59e0b" bg="bg-amber-50" />
            <StatCard icon={TrendingUp} label="مجموع خرید" value={Math.round(totalSpent).toLocaleString('fa-IR') + ' ت'} color="#8b5cf6" bg="bg-violet-50" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو نام، تلفن، ایمیل..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm transition-all" />
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleExcelImport} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
              <Upload className="w-4 h-4" /><span>ورود CSV</span>
            </button>
            <button onClick={exportCustomers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
              <Download className="w-4 h-4" /><span>خروجی CSV</span>
            </button>
            <button onClick={() => { setEditing(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>مشتری جدید</span>
            </button>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
              <Users className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">هنوز مشتری‌ای ثبت نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map(c => {
                const group = groups.find(g => g.id === c.group_id);
                return (
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
                      {group && <div className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-gray-300" /><span>{group.name}</span></div>}
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
                      <button onClick={() => setShowPrefModal(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                        <Heart className="w-3.5 h-3.5" /><span>سلیقه</span>
                      </button>
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">گروه‌بندی مشتریان برای تخفیف و کمپین</p>
            <button onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>گروه جدید</span>
            </button>
          </div>
          {groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <Tag className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">هنوز گروهی ایجاد نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(g => {
                const memberCount = customers.filter(c => c.group_id === g.id).length;
                return (
                  <div key={g.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                          <Tag className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-sm">{g.name}</h4>
                          <p className="text-xs text-gray-400">{memberCount} عضو</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${g.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                        {g.is_active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>
                    {g.description && <p className="text-xs text-gray-500 mb-2">{g.description}</p>}
                    <div className="flex items-center gap-2 mb-3">
                      <Gift className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-gray-700">تخفیف: {Number(g.discount_percent)}٪</span>
                    </div>
                    <div className="flex items-center gap-1 pt-3 border-t border-gray-50">
                      <button onClick={() => { setEditingGroup(g); setShowGroupModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600">
                        <Edit3 className="w-3.5 h-3.5" /><span>ویرایش</span>
                      </button>
                      <button onClick={() => handleDeleteGroup(g.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" /><span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">مدیریت کمپین‌های بازاریابی و پیامکی</p>
            <button onClick={() => { setEditingCampaign(null); setShowCampaignModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>کمپین جدید</span>
            </button>
          </div>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <Megaphone className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">هنوز کمپینی ایجاد نشده است</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-gray-400 text-xs">
                      <th className="text-right font-medium px-4 py-3">نام کمپین</th>
                      <th className="text-right font-medium px-4 py-3">نوع</th>
                      <th className="text-right font-medium px-4 py-3">گروه هدف</th>
                      <th className="text-right font-medium px-4 py-3">ارسال شده</th>
                      <th className="text-right font-medium px-4 py-3">وضعیت</th>
                      <th className="text-center font-medium px-4 py-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                            {campaignTypeLabels[c.campaign_type] || c.campaign_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{c.customer_groups?.name || 'همه'}</td>
                        <td className="px-4 py-3 text-gray-500">{c.sent_count.toLocaleString('fa-IR')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full ${campaignStatusColors[c.status] || 'bg-gray-50 text-gray-500'}`}>
                            {campaignStatusLabels[c.status] || c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => { setEditingCampaign(c); setShowCampaignModal(true); }}
                              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteCampaign(c.id)}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SMS Logs Tab */}
      {activeTab === 'sms' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">تاریخچه پیامک‌های ارسالی (۱۰۰ مورد اخیر)</p>
          {smsLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">پیامکی ارسال نشده است</p>
            </div>
          ) : (
            <div className="space-y-2">
              {smsLogs.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    s.status === 'sent' || s.status === 'delivered' ? 'bg-emerald-50' :
                    s.status === 'failed' ? 'bg-red-50' : 'bg-gray-50'
                  }`}>
                    {s.status === 'sent' || s.status === 'delivered' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                     s.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                     <Clock className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-700" dir="ltr">{s.phone}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === 'sent' ? 'bg-emerald-50 text-emerald-600' :
                        s.status === 'failed' ? 'bg-red-50 text-red-600' :
                        s.status === 'delivered' ? 'bg-blue-50 text-blue-600' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {s.status === 'sent' ? 'ارسال شد' : s.status === 'failed' ? 'خطا' : s.status === 'delivered' ? 'تحویل شد' : 'در انتظار'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{s.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(s.created_at).toLocaleDateString('fa-IR')} {new Date(s.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <CustomerModal customer={editing} groups={groups} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll(); }} />
      )}
      {showGroupModal && (
        <GroupModal group={editingGroup} onClose={() => setShowGroupModal(false)} onSaved={() => { setShowGroupModal(false); fetchAll(); }} />
      )}
      {showCampaignModal && (
        <CampaignModal campaign={editingCampaign} groups={groups} customers={customers} onClose={() => setShowCampaignModal(false)} onSaved={() => { setShowCampaignModal(false); fetchAll(); }} />
      )}
      {showPrefModal && (
        <PreferenceModal customer={showPrefModal} onClose={() => setShowPrefModal(null)} />
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

function CustomerModal({ customer, groups, onClose, onSaved }: {
  customer: Customer | null;
  groups: CustomerGroup[];
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
    group_id: customer?.group_id || '',
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
      group_id: form.group_id || null,
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">گروه مشتری</label>
              <select value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })} className="modal-input">
                <option value="">بدون گروه</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">امتیاز وفاداری</label>
            <input type="number" value={form.loyalty_points} onChange={e => setForm({ ...form, loyalty_points: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
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

function GroupModal({ group, onClose, onSaved }: {
  group: CustomerGroup | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    discount_percent: group?.discount_percent ?? 0,
    is_active: group?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, description: form.description || null, discount_percent: Number(form.discount_percent) };
    const { error: err } = group
      ? await supabase.from('customer_groups').update(payload).eq('id', group.id)
      : await supabase.from('customer_groups').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{group ? 'ویرایش گروه' : 'گروه جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام گروه <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">درصد تخفیف</label>
            <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} min="0" max="100" dir="ltr" className="modal-input" />
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

function CampaignModal({ campaign, groups, customers, onClose, onSaved }: {
  campaign: Campaign | null;
  groups: CustomerGroup[];
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: campaign?.name || '',
    campaign_type: campaign?.campaign_type || 'sms',
    target_group_id: campaign?.target_group_id || '',
    discount_percent: campaign?.discount_percent ?? 0,
    credit_amount: campaign?.credit_amount ?? 0,
    sms_message: campaign?.sms_message || '',
    start_date: campaign?.start_date ? campaign.start_date.slice(0, 10) : '',
    end_date: campaign?.end_date ? campaign.end_date.slice(0, 10) : '',
    status: campaign?.status || 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      campaign_type: form.campaign_type,
      target_group_id: form.target_group_id || null,
      discount_percent: Number(form.discount_percent) || 0,
      credit_amount: Number(form.credit_amount) || 0,
      sms_message: form.sms_message || null,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      status: form.status,
    };
    const { error: err } = campaign
      ? await supabase.from('campaigns').update(payload).eq('id', campaign.id)
      : await supabase.from('campaigns').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  const handleSendSms = async () => {
    if (!form.sms_message || !form.target_group_id) {
      alert('برای ارسال پیامک، گروه هدف و متن پیام الزامی است');
      return;
    }
    const targetCustomers = customers.filter(c => c.group_id === form.target_group_id && c.phone);
    if (targetCustomers.length === 0) { alert('مشتری با تلفن در این گروه یافت نشد'); return; }
    if (!confirm(`ارسال پیامک به ${targetCustomers.length} مشتری؟`)) return;

    setSaving(true);
    const { data: campData } = await supabase.from('campaigns').insert({
      name: form.name,
      campaign_type: 'sms',
      target_group_id: form.target_group_id,
      sms_message: form.sms_message,
      status: 'active',
      start_date: new Date().toISOString(),
    }).select('id').single();

    if (!campData) { setError('خطا در ایجاد کمپین'); setSaving(false); return; }

    const smsRows = targetCustomers.map(c => ({
      campaign_id: campData.id,
      customer_id: c.id,
      phone: c.phone!,
      message: form.sms_message,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }));

    const { error: smsErr } = await supabase.from('sms_logs').insert(smsRows);
    await supabase.from('campaigns').update({ sent_count: smsRows.length }).eq('id', campData.id);

    if (smsErr) { setError(smsErr.message); setSaving(false); return; }
    alert(`${smsRows.length} پیامک ثبت شد`);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">{campaign ? 'ویرایش کمپین' : 'کمپین جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام کمپین <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع کمپین</label>
              <select value={form.campaign_type} onChange={e => setForm({ ...form, campaign_type: e.target.value })} className="modal-input">
                {Object.entries(campaignTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">گروه هدف</label>
              <select value={form.target_group_id} onChange={e => setForm({ ...form, target_group_id: e.target.value })} className="modal-input">
                <option value="">همه مشتریان</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          {form.campaign_type === 'discount' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">درصد تخفیف</label>
              <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} min="0" max="100" dir="ltr" className="modal-input" />
            </div>
          )}
          {form.campaign_type === 'credit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">مبلغ اعتبار (تومان)</label>
              <input type="number" value={form.credit_amount} onChange={e => setForm({ ...form, credit_amount: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
            </div>
          )}
          {form.campaign_type === 'sms' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">متن پیامک</label>
              <textarea value={form.sms_message} onChange={e => setForm({ ...form, sms_message: e.target.value })} rows={3} className="modal-input" placeholder="متن پیامک..." />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ شروع</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} dir="ltr" className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ پایان</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} dir="ltr" className="modal-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">وضعیت</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="modal-input">
              {Object.entries(campaignStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            {form.campaign_type === 'sms' && (
              <button type="button" onClick={handleSendSms} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60">
                <Send className="w-4 h-4" /><span>ارسال پیامک</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreferenceModal({ customer, onClose }: {
  customer: Customer;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [newPref, setNewPref] = useState({
    preference_type: 'favorite',
    product_id: '',
    preference_value: '',
  });

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    const [{ data: prefData }, { data: prodData }] = await Promise.all([
      supabase.from('customer_preferences').select('*, products(name)').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    setPrefs((prefData as Preference[]) || []);
    setProducts((prodData as { id: string; name: string }[]) || []);
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const handleAdd = async () => {
    const { error } = await supabase.from('customer_preferences').insert({
      customer_id: customer.id,
      product_id: newPref.product_id || null,
      preference_type: newPref.preference_type,
      preference_value: newPref.preference_value || null,
    });
    if (error) alert('خطا: ' + error.message);
    else { setNewPref({ preference_type: 'favorite', product_id: '', preference_value: '' }); fetchPrefs(); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('customer_preferences').delete().eq('id', id);
    fetchPrefs();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">سلیقه و ترجیحات: {customer.full_name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
          ) : (
            <>
              {/* Add new preference */}
              <div className="bg-gray-50/50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">افزودن ترجیح</h4>
                <div className="grid grid-cols-2 gap-3">
                  <select value={newPref.preference_type} onChange={e => setNewPref({ ...newPref, preference_type: e.target.value })} className="modal-input text-sm">
                    {Object.entries(prefTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={newPref.product_id} onChange={e => setNewPref({ ...newPref, product_id: e.target.value })} className="modal-input text-sm">
                    <option value="">محصول (اختیاری)</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newPref.preference_value} onChange={e => setNewPref({ ...newPref, preference_value: e.target.value })}
                    placeholder="توضیح (اختیاری)" className="modal-input text-sm flex-1" />
                  <button onClick={handleAdd} className="px-4 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Existing preferences */}
              {prefs.length === 0 ? (
                <div className="text-center py-8">
                  <Heart className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">هنوز ترجیشی ثبت نشده است</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prefs.map(p => {
                    const Icon = prefTypeIcons[p.preference_type] || StickyNote;
                    return (
                      <div key={p.id} className="flex items-center gap-3 bg-gray-50/50 rounded-xl px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${prefTypeColors[p.preference_type] || 'bg-gray-50'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">{prefTypeLabels[p.preference_type] || p.preference_type}</p>
                          <p className="text-xs text-gray-500">
                            {p.products?.name && <span>{p.products.name}</span>}
                            {p.preference_value && <span> — {p.preference_value}</span>}
                          </p>
                        </div>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
