import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Wallet, Plus, Loader2, X, Save, AlertCircle, TrendingUp,
  TrendingDown, Receipt, ArrowDownCircle, ArrowUpCircle, Clock,
  CheckCircle2, Search, Filter
} from 'lucide-react';

type Branch = { id: string; name: string };
type ExpenseCategory = { id: string; name: string; color: string; is_system: boolean };

type Expense = {
  id: string;
  branch_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string;
  status: string;
  created_at: string;
  expense_categories?: { name: string; color: string } | null;
};

type Transaction = {
  id: string;
  branch_id: string;
  type: string;
  direction: string;
  amount: number;
  description: string | null;
  reference_type: string | null;
  created_at: string;
};

type CashRegister = {
  id: string;
  branch_id: string;
  session_number: string;
  opened_by: string | null;
  opened_at: string;
  opening_balance: number;
  closed_by: string | null;
  closed_at: string | null;
  closing_balance: number | null;
  status: string;
  notes: string | null;
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدی',
  card: 'کارت',
  online: 'آنلاین',
  wallet: 'کیف پول',
};

const transactionTypeLabels: Record<string, string> = {
  sale: 'فروش',
  expense: 'هزینه',
  adjustment: 'تعدیل',
  transfer: 'انتقال',
  refund: 'بازگشت وجه',
};

const transactionTypeColors: Record<string, string> = {
  sale: 'text-emerald-600',
  expense: 'text-red-600',
  adjustment: 'text-blue-600',
  transfer: 'text-amber-600',
  refund: 'text-purple-600',
};

export function AccountingPage() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(profile?.default_branch_id || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'cash' | 'transactions'>('overview');
  const [loading, setLoading] = useState(true);

  // Overview stats
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    todayIncome: 0,
    todayExpenses: 0,
    openRegister: null as CashRegister | null,
  expenseByCategory: [] as Array<{ name: string; color: string; total: number }>,
  });

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState('all');

  // Cash registers
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerOpeningBalance, setRegisterOpeningBalance] = useState(0);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: brs }, { data: cats }] = await Promise.all([
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('expense_categories').select('*').order('name'),
      ]);
      setBranches((brs as Branch[]) || []);
      setCategories((cats as ExpenseCategory[]) || []);
      if (!branchId && (brs as Branch[])?.length > 0) setBranchId((brs as Branch[])[0].id);
    })();
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      { data: incomeData },
      { data: expenseData },
      { data: todayIncomeData },
      { data: todayExpenseData },
      { data: openReg },
      { data: expenseByCat },
    ] = await Promise.all([
      supabase.from('transactions').select('amount').eq('branch_id', branchId).eq('direction', 'in'),
      supabase.from('transactions').select('amount').eq('branch_id', branchId).eq('direction', 'out'),
      supabase.from('transactions').select('amount').eq('branch_id', branchId).eq('direction', 'in').gte('created_at', todayStart),
      supabase.from('transactions').select('amount').eq('branch_id', branchId).eq('direction', 'out').gte('created_at', todayStart),
      supabase.from('cash_registers').select('*').eq('branch_id', branchId).eq('status', 'open').maybeSingle(),
      supabase.from('expenses').select('amount, expense_categories!expenses_category_id_fkey ( name, color )').eq('branch_id', branchId),
    ]);

    const totalIncome = (incomeData || []).reduce((s, r: any) => s + Number(r.amount), 0);
    const totalExpenses = (expenseData || []).reduce((s, r: any) => s + Number(r.amount), 0);
    const todayIncome = (todayIncomeData || []).reduce((s, r: any) => s + Number(r.amount), 0);
    const todayExpenses = (todayExpenseData || []).reduce((s, r: any) => s + Number(r.amount), 0);

    const catMap = new Map<string, { color: string; total: number }>();
    (expenseByCat || []).forEach((e: any) => {
      const catName = e.expense_categories?.name || 'بدون دسته';
      const catColor = e.expense_categories?.color || '#6b7280';
      const existing = catMap.get(catName);
      if (existing) existing.total += Number(e.amount);
      else catMap.set(catName, { color: catColor, total: Number(e.amount) });
    });

    setStats({
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      todayIncome,
      todayExpenses,
      openRegister: (openReg as CashRegister) || null,
      expenseByCategory: Array.from(catMap.entries()).map(([name, v]) => ({ name, color: v.color, total: v.total })).sort((a, b) => b.total - a.total),
    });
    setLoading(false);
  }, [branchId]);

  const fetchExpenses = useCallback(async () => {
    if (!branchId) return;
    let query = supabase
      .from('expenses')
      .select('*, expense_categories!expenses_category_id_fkey ( name, color )')
      .eq('branch_id', branchId)
      .order('expense_date', { ascending: false });
    if (expenseFilter !== 'all') query = query.eq('payment_method', expenseFilter);
    const { data } = await query;
    setExpenses((data as Expense[]) || []);
  }, [branchId, expenseFilter]);

  const fetchRegisters = useCallback(async () => {
    if (!branchId) return;
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(20);
    setRegisters((data as CashRegister[]) || []);
  }, [branchId]);

  const fetchTransactions = useCallback(async () => {
    if (!branchId) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(50);
    setTransactions((data as Transaction[]) || []);
  }, [branchId]);

  useEffect(() => {
    fetchOverview();
    fetchExpenses();
    fetchRegisters();
    fetchTransactions();
  }, [fetchOverview, fetchExpenses, fetchRegisters, fetchTransactions]);

  const refreshAll = () => { fetchOverview(); fetchExpenses(); fetchRegisters(); fetchTransactions(); };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {([
            { key: 'overview', label: 'خلاصه' },
            { key: 'expenses', label: 'هزینه‌ها' },
            { key: 'cash', label: 'صندوق' },
            { key: 'transactions', label: 'تراکنش‌ها' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && activeTab === 'overview' ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : activeTab === 'overview' ? (
        <OverviewTab stats={stats} onGoExpenses={() => setActiveTab('expenses')} onGoCash={() => setActiveTab('cash')} />
      ) : activeTab === 'expenses' ? (
        <ExpensesTab
          expenses={expenses}
          categories={categories}
          expenseFilter={expenseFilter}
          setExpenseFilter={setExpenseFilter}
          onAdd={() => setShowExpenseModal(true)}
          branchId={branchId}
          profile={profile}
          onSaved={refreshAll}
        />
      ) : activeTab === 'cash' ? (
        <CashTab
          registers={registers}
          openRegister={stats.openRegister}
          onOpen={() => setShowRegisterModal(true)}
          branchId={branchId}
          profile={profile}
          onSaved={refreshAll}
          registerOpeningBalance={registerOpeningBalance}
          setRegisterOpeningBalance={setRegisterOpeningBalance}
        />
      ) : (
        <TransactionsTab transactions={transactions} />
      )}

      {showExpenseModal && (
        <ExpenseModal
          categories={categories}
          branchId={branchId}
          profile={profile}
          onClose={() => setShowExpenseModal(false)}
          onSaved={() => { setShowExpenseModal(false); refreshAll(); }}
        />
      )}

      {showRegisterModal && (
        <OpenRegisterModal
          branchId={branchId}
          profile={profile}
          openingBalance={registerOpeningBalance}
          setOpeningBalance={setRegisterOpeningBalance}
          onClose={() => setShowRegisterModal(false)}
          onSaved={() => { setShowRegisterModal(false); refreshAll(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Overview Tab
// ============================================================
function OverviewTab({ stats, onGoExpenses, onGoCash }: {
  stats: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    todayIncome: number;
    todayExpenses: number;
    openRegister: CashRegister | null;
    expenseByCategory: Array<{ name: string; color: string; total: number }>;
  };
  onGoExpenses: () => void;
  onGoCash: () => void;
}) {
  const cards = [
    { label: 'درآمد کل', value: stats.totalIncome, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: 'هزینه‌های کل', value: stats.totalExpenses, icon: TrendingDown, color: 'from-red-500 to-red-600', bg: 'bg-red-50', textColor: 'text-red-600' },
    { label: 'سود خالص', value: stats.netProfit, icon: Wallet, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', textColor: 'text-amber-600' },
    { label: 'درآمد امروز', value: stats.todayIncome, icon: ArrowUpCircle, color: 'from-teal-500 to-teal-600', bg: 'bg-teal-50', textColor: 'text-teal-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
                <span className={`text-2xl font-bold ${card.textColor}`} dir="ltr">{Math.round(card.value).toLocaleString('fa-IR')}</span>
              </div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-xs text-gray-300 mt-0.5">تومان</p>
            </div>
          );
        })}
      </div>

      {/* Cash Register Status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-800">وضعیت صندوق</h3>
          </div>
          <button onClick={onGoCash} className="text-sm text-amber-600 hover:text-amber-700 font-medium">مدیریت صندوق</button>
        </div>
        {stats.openRegister ? (
          <div className="flex items-center gap-4 bg-emerald-50/50 rounded-xl p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">صندوق باز است</p>
              <p className="text-xs text-gray-400">شماره جلسه: {stats.openRegister.session_number} — باز شده در {new Date(stats.openRegister.opened_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-400">موجودی ابتدایی</p>
              <p className="text-sm font-bold text-gray-700" dir="ltr">{Number(stats.openRegister.opening_balance).toLocaleString('fa-IR')} ت</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 bg-gray-50/50 rounded-xl p-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">صندوق بسته است</p>
              <p className="text-xs text-gray-400">برای شروع کار، صندوق را باز کنید</p>
            </div>
            <button onClick={onGoCash} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">باز کردن صندوق</button>
          </div>
        )}
      </div>

      {/* Expenses by Category */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-800">هزینه‌ها بر اساس دسته</h3>
          </div>
          <button onClick={onGoExpenses} className="text-sm text-amber-600 hover:text-amber-700 font-medium">مدیریت هزینه‌ها</button>
        </div>
        {stats.expenseByCategory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">هزینه‌ای ثبت نشده است</p>
        ) : (
          <div className="space-y-3">
            {stats.expenseByCategory.map(cat => {
              const maxTotal = Math.max(...stats.expenseByCategory.map(c => c.total));
              const widthPercent = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full" style={{ backgroundColor: cat.color }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-600">{cat.name}</span>
                      <span className="text-sm font-bold text-gray-800" dir="ltr">{Math.round(cat.total).toLocaleString('fa-IR')} ت</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${widthPercent}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Expenses Tab
// ============================================================
function ExpensesTab({ expenses, categories, expenseFilter, setExpenseFilter, onAdd }: {
  expenses: Expense[];
  categories: ExpenseCategory[];
  expenseFilter: string;
  setExpenseFilter: (f: string) => void;
  onAdd: () => void;
  branchId: string;
  profile: any;
  onSaved: () => void;
}) {
  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این هزینه مطمئن هستید؟')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) alert('خطا: ' + error.message);
  };

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={expenseFilter} onChange={(e) => setExpenseFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none text-sm bg-white">
            <option value="all">همه روش‌ها</option>
            {Object.entries(paymentMethodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="text-sm text-gray-500">
          مجموع: <span className="font-bold text-gray-800" dir="ltr">{Math.round(totalAmount).toLocaleString('fa-IR')} ت</span>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all whitespace-nowrap mr-auto">
          <Plus className="w-4 h-4" /><span>ثبت هزینه</span>
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">هزینه‌ای ثبت نشده است</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">توضیحات</th>
                  <th className="text-right font-medium px-4 py-3">دسته</th>
                  <th className="text-right font-medium px-4 py-3">مبلغ</th>
                  <th className="text-right font-medium px-4 py-3">روش پرداخت</th>
                  <th className="text-right font-medium px-4 py-3">تاریخ</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{e.description || '—'}</td>
                    <td className="px-4 py-3">
                      {e.expense_categories ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.expense_categories.color }} />
                          {e.expense_categories.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-bold" dir="ltr">{Number(e.amount).toLocaleString('fa-IR')} ت</td>
                    <td className="px-4 py-3"><span className="text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-500">{paymentMethodLabels[e.payment_method] || e.payment_method}</span></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(e.expense_date).toLocaleDateString('fa-IR')}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Cash Tab
// ============================================================
function CashTab({ registers, openRegister, onOpen, branchId, profile, onSaved, registerOpeningBalance, setRegisterOpeningBalance }: {
  registers: CashRegister[];
  openRegister: CashRegister | null;
  onOpen: () => void;
  branchId: string;
  profile: any;
  onSaved: () => void;
  registerOpeningBalance: number;
  setRegisterOpeningBalance: (n: number) => void;
}) {
  const handleClose = async () => {
    if (!openRegister) return;
    const closingBalanceStr = prompt('موجودی نهایی صندوق را وارد کنید (تومان):', String(openRegister.opening_balance));
    if (closingBalanceStr === null) return;
    const closingBalance = Number(closingBalanceStr);
    if (isNaN(closingBalance)) { alert('مقدار نامعتبر'); return; }

    const { error } = await supabase.from('cash_registers').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closing_balance: closingBalance,
      closed_by: profile?.id || null,
    }).eq('id', openRegister.id);

    if (error) alert('خطا: ' + error.message);
    else onSaved();
  };

  return (
    <div className="space-y-4">
      {/* Current Register */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-800">صندوق فعلی</h3>
          </div>
          {openRegister ? (
            <button onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
              <ArrowDownCircle className="w-4 h-4" /><span>بستن صندوق</span>
            </button>
          ) : (
            <button onClick={onOpen}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 hover:shadow-lg transition-all">
              <Plus className="w-4 h-4" /><span>باز کردن صندوق</span>
            </button>
          )}
        </div>
        {openRegister ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">شماره جلسه</p>
              <p className="text-sm font-bold text-gray-700" dir="ltr">{openRegister.session_number}</p>
            </div>
            <div className="bg-gray-50/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">موجودی ابتدایی</p>
              <p className="text-sm font-bold text-gray-700" dir="ltr">{Number(openRegister.opening_balance).toLocaleString('fa-IR')} ت</p>
            </div>
            <div className="bg-gray-50/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">ساعت باز شدن</p>
              <p className="text-sm font-bold text-gray-700">{new Date(openRegister.opened_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="bg-emerald-50/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">وضعیت</p>
              <span className="text-sm font-bold text-emerald-600">باز</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">صندوقی باز نیست</p>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800 text-sm">تاریخچه صندوق</h3>
        </div>
        {registers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">رکوردی وجود ندارد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">شماره</th>
                  <th className="text-right font-medium px-4 py-3">موجودی ابتدایی</th>
                  <th className="text-right font-medium px-4 py-3">موجودی نهایی</th>
                  <th className="text-right font-medium px-4 py-3">باز شدن</th>
                  <th className="text-right font-medium px-4 py-3">بسته شدن</th>
                  <th className="text-right font-medium px-4 py-3">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {registers.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-700" dir="ltr">{r.session_number}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{Number(r.opening_balance).toLocaleString('fa-IR')} ت</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{r.closing_balance !== null ? Number(r.closing_balance).toLocaleString('fa-IR') + ' ت' : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.opened_at).toLocaleDateString('fa-IR')} {new Date(r.opened_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3 text-gray-500">{r.closed_at ? `${new Date(r.closed_at).toLocaleDateString('fa-IR')} ${new Date(r.closed_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-500'}`}>
                        {r.status === 'open' ? 'باز' : 'بسته'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Transactions Tab
// ============================================================
function TransactionsTab({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">تراکنشی ثبت نشده است</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-gray-400 text-xs">
                <th className="text-right font-medium px-4 py-3">نوع</th>
                <th className="text-right font-medium px-4 py-3">شرح</th>
                <th className="text-right font-medium px-4 py-3">مبلغ</th>
                <th className="text-right font-medium px-4 py-3">جهت</th>
                <th className="text-right font-medium px-4 py-3">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${transactionTypeColors[t.type] || 'text-gray-500'}`}>
                      {transactionTypeLabels[t.type] || t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.description || '—'}</td>
                  <td className="px-4 py-3 font-bold text-gray-800" dir="ltr">{Number(t.amount).toLocaleString('fa-IR')} ت</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.direction === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {t.direction === 'in' ? 'ورودی' : 'خروجی'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.created_at).toLocaleDateString('fa-IR')} {new Date(t.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Expense Modal
// ============================================================
function ExpenseModal({ categories, branchId, profile, onClose, onSaved }: {
  categories: ExpenseCategory[];
  branchId: string;
  profile: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category_id: '',
    amount: 0,
    description: '',
    payment_method: 'cash',
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (form.amount <= 0) { setError('مبلغ باید بزرگتر از صفر باشد'); setSaving(false); return; }

    const { data: expData, error: expError } = await supabase.from('expenses').insert({
      branch_id: branchId,
      category_id: form.category_id || null,
      amount: form.amount,
      description: form.description || null,
      expense_date: new Date(form.expense_date).toISOString(),
      payment_method: form.payment_method,
      status: 'paid',
      created_by: profile?.id || null,
    }).select('id').single();

    if (expError) { setError(expError.message); setSaving(false); return; }

    await supabase.from('transactions').insert({
      branch_id: branchId,
      type: 'expense',
      direction: 'out',
      amount: form.amount,
      reference_type: 'expense',
      reference_id: expData.id,
      description: form.description || `هزینه: ${categories.find(c => c.id === form.category_id)?.name || 'بدون دسته'}`,
    });

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">ثبت هزینه</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">دسته</label>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="modal-input">
              <option value="">بدون دسته</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">مبلغ (تومان) <span className="text-red-400">*</span></label>
            <input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="modal-input" placeholder="اختیاری" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">روش پرداخت</label>
              <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="modal-input">
                {Object.entries(paymentMethodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ</label>
              <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} dir="ltr" className="modal-input" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ثبت</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Open Register Modal
// ============================================================
function OpenRegisterModal({ branchId, profile, openingBalance, setOpeningBalance, onClose, onSaved }: {
  branchId: string;
  profile: any;
  openingBalance: number;
  setOpeningBalance: (n: number) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: seqData, error: seqError } = await supabase.rpc('next_number', {
      p_sequence_key: 'cash_register',
      p_branch_id: branchId,
    });
    if (seqError) { setError('خطا در تولید شماره: ' + seqError.message); setSaving(false); return; }

    const { error: regError } = await supabase.from('cash_registers').insert({
      branch_id: branchId,
      session_number: seqData as string,
      opened_by: profile?.id || null,
      opened_at: new Date().toISOString(),
      opening_balance: openingBalance,
      status: 'open',
    });

    if (regError) { setError(regError.message); setSaving(false); return; }

    if (openingBalance > 0) {
      await supabase.from('transactions').insert({
        branch_id: branchId,
        type: 'adjustment',
        direction: 'in',
        amount: openingBalance,
        description: 'موجودی ابتدایی صندوق',
      });
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">باز کردن صندوق</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">موجودی ابتدایی (تومان)</label>
            <input type="number" value={openingBalance || ''} onChange={e => setOpeningBalance(Number(e.target.value))} min="0" dir="ltr" className="modal-input" placeholder="0" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>باز کردن</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
