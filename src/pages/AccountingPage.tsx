import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Wallet, Plus, Loader2, X, Save, AlertCircle, TrendingUp,
  TrendingDown, Receipt, ArrowDownCircle, ArrowUpCircle, Clock,
  CheckCircle2, Search, Filter, Landmark, BookOpen, FileText,
  PiggyBank, Trash2, Edit3, Building2, CreditCard, Banknote
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
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'cash' | 'transactions' | 'accounts' | 'journal' | 'budgets'>('overview');
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

  // Financial accounts
  const [finAccounts, setFinAccounts] = useState<FinancialAccount[]>([]);
  const [showFinAcctModal, setShowFinAcctModal] = useState(false);
  const [editingFinAcct, setEditingFinAcct] = useState<FinancialAccount | null>(null);

  // Chart of accounts
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartAccount | null>(null);

  // Journal entries
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);

  // Budgets
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

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

  const fetchFinAccounts = useCallback(async () => {
    const { data } = await supabase.from('financial_accounts').select('*').order('name');
    setFinAccounts((data as FinancialAccount[]) || []);
  }, []);

  const fetchChartAccounts = useCallback(async () => {
    const { data } = await supabase.from('chart_accounts').select('*').order('code');
    setChartAccounts((data as ChartAccount[]) || []);
  }, []);

  const fetchJournalEntries = useCallback(async () => {
    const { data } = await supabase
      .from('journal_entries')
      .select('*, debit_account:chart_accounts!journal_entries_debit_account_id_fkey(name), credit_account:chart_accounts!journal_entries_credit_account_id_fkey(name)')
      .order('entry_date', { ascending: false })
      .limit(50);
    setJournalEntries((data as JournalEntry[]) || []);
  }, []);

  const fetchBudgets = useCallback(async () => {
    const { data } = await supabase.from('budgets').select('*').order('period_start', { ascending: false });
    setBudgets((data as Budget[]) || []);
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchExpenses();
    fetchRegisters();
    fetchTransactions();
    fetchFinAccounts();
    fetchChartAccounts();
    fetchJournalEntries();
    fetchBudgets();
  }, [fetchOverview, fetchExpenses, fetchRegisters, fetchTransactions, fetchFinAccounts, fetchChartAccounts, fetchJournalEntries, fetchBudgets]);

  const refreshAll = () => { fetchOverview(); fetchExpenses(); fetchRegisters(); fetchTransactions(); fetchFinAccounts(); fetchChartAccounts(); fetchJournalEntries(); fetchBudgets(); };

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
            { key: 'accounts', label: 'حساب‌های بانکی' },
            { key: 'journal', label: 'دفتر روزنامه' },
            { key: 'budgets', label: 'بودجه' },
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
      ) : activeTab === 'transactions' ? (
        <TransactionsTab transactions={transactions} />
      ) : activeTab === 'accounts' ? (
        <AccountsTab
          finAccounts={finAccounts}
          onAdd={() => { setEditingFinAcct(null); setShowFinAcctModal(true); }}
          onEdit={(a) => { setEditingFinAcct(a); setShowFinAcctModal(true); }}
          onDelete={async (id) => { if (confirm('حذف این حساب؟')) { await supabase.from('financial_accounts').delete().eq('id', id); refreshAll(); } }}
          chartAccounts={chartAccounts}
          onAddChart={() => { setEditingChart(null); setShowChartModal(true); }}
          onEditChart={(a) => { setEditingChart(a); setShowChartModal(true); }}
          onDeleteChart={async (id) => { if (confirm('حذف این حساب از دفتر کل؟')) { await supabase.from('chart_accounts').delete().eq('id', id); refreshAll(); } }}
        />
      ) : activeTab === 'journal' ? (
        <JournalTab
          entries={journalEntries}
          chartAccounts={chartAccounts}
          onAdd={() => setShowJournalModal(true)}
          onDelete={async (id) => { if (confirm('حذف این سند؟')) { await supabase.from('journal_entries').delete().eq('id', id); refreshAll(); } }}
        />
      ) : (
        <BudgetsTab
          budgets={budgets}
          onAdd={() => { setEditingBudget(null); setShowBudgetModal(true); }}
          onEdit={(b) => { setEditingBudget(b); setShowBudgetModal(true); }}
          onDelete={async (id) => { if (confirm('حذف این بودجه؟')) { await supabase.from('budgets').delete().eq('id', id); refreshAll(); } }}
        />
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

      {showFinAcctModal && (
        <FinAccountModal account={editingFinAcct} onClose={() => setShowFinAcctModal(false)} onSaved={() => { setShowFinAcctModal(false); refreshAll(); }} />
      )}
      {showChartModal && (
        <ChartAccountModal account={editingChart} onClose={() => setShowChartModal(false)} onSaved={() => { setShowChartModal(false); refreshAll(); }} />
      )}
      {showJournalModal && (
        <JournalModal chartAccounts={chartAccounts} profile={profile} onClose={() => setShowJournalModal(false)} onSaved={() => { setShowJournalModal(false); refreshAll(); }} />
      )}
      {showBudgetModal && (
        <BudgetModal budget={editingBudget} onClose={() => setShowBudgetModal(false)} onSaved={() => { setShowBudgetModal(false); refreshAll(); }} />
      )}
    </div>
  );
}

// ============================================================
// Types for financial accounts, chart, journal, budgets
// ============================================================
type FinancialAccount = {
  id: string;
  name: string;
  account_type: string;
  bank_name: string | null;
  bank_branch: string | null;
  account_number: string | null;
  card_number: string | null;
  iban: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
};

type ChartAccount = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  account_type: string;
  level: number;
  is_active: boolean;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
  amount: number;
  reference_type: string | null;
  created_at: string;
  debit_account?: { name: string } | null;
  credit_account?: { name: string } | null;
};

type Budget = {
  id: string;
  name: string;
  period_type: string;
  period_start: string;
  period_end: string;
  revenue_budget: number;
  expense_budget: number;
  notes: string | null;
  created_at: string;
};

const finAcctTypeLabels: Record<string, string> = {
  bank: 'بانک',
  cash: 'صندوق',
  petty_cash: 'تنخواه',
};

const chartAcctTypeLabels: Record<string, string> = {
  asset: 'دارایی',
  liability: 'بدهی',
  equity: 'سرمایه',
  revenue: 'درآمد',
  expense: 'هزینه',
};

const chartAcctTypeColors: Record<string, string> = {
  asset: 'bg-blue-50 text-blue-600',
  liability: 'bg-red-50 text-red-600',
  equity: 'bg-amber-50 text-amber-600',
  revenue: 'bg-emerald-50 text-emerald-600',
  expense: 'bg-orange-50 text-orange-600',
};

const budgetPeriodLabels: Record<string, string> = {
  monthly: 'ماهانه',
  quarterly: 'فصلی',
  yearly: 'سالانه',
};

// ============================================================
// Accounts Tab (Financial Accounts + Chart of Accounts)
// ============================================================
function AccountsTab({ finAccounts, onAdd, onEdit, onDelete, chartAccounts, onAddChart, onEditChart, onDeleteChart }: {
  finAccounts: FinancialAccount[];
  onAdd: () => void;
  onEdit: (a: FinancialAccount) => void;
  onDelete: (id: string) => void;
  chartAccounts: ChartAccount[];
  onAddChart: () => void;
  onEditChart: (a: ChartAccount) => void;
  onDeleteChart: (id: string) => void;
}) {
  const [subTab, setSubTab] = useState<'fin' | 'chart'>('fin');
  const totalBalance = finAccounts.reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        <button onClick={() => setSubTab('fin')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'fin' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>حساب‌های مالی</button>
        <button onClick={() => setSubTab('chart')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'chart' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>دفتر کل</button>
      </div>

      {subTab === 'fin' ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">مجموع موجودی: <span className="font-bold text-gray-800" dir="ltr">{Math.round(totalBalance).toLocaleString('fa-IR')} ت</span></div>
            <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>حساب جدید</span>
            </button>
          </div>
          {finAccounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">هنوز حسابی ثبت نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {finAccounts.map(a => (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.account_type === 'bank' ? 'bg-blue-50' : a.account_type === 'cash' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        {a.account_type === 'bank' ? <Landmark className="w-5 h-5 text-blue-500" /> : a.account_type === 'cash' ? <Banknote className="w-5 h-5 text-emerald-500" /> : <Wallet className="w-5 h-5 text-amber-500" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{a.name}</h4>
                        <p className="text-xs text-gray-400">{finAcctTypeLabels[a.account_type] || a.account_type}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${a.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                      {a.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    {a.bank_name && <div>بانک: {a.bank_name}</div>}
                    {a.account_number && <div dir="ltr">شماره: {a.account_number}</div>}
                    {a.card_number && <div dir="ltr">کارت: {a.card_number}</div>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">موجودی فعلی</p>
                      <p className="text-sm font-bold text-gray-800" dir="ltr">{Math.round(Number(a.current_balance)).toLocaleString('fa-IR')} ت</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEdit(a)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(a.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">دفتر کل و حساب‌های سیستمی</p>
            <button onClick={onAddChart} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>حساب جدید</span>
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-gray-400 text-xs">
                    <th className="text-right font-medium px-4 py-3">کد</th>
                    <th className="text-right font-medium px-4 py-3">نام</th>
                    <th className="text-right font-medium px-4 py-3">نوع</th>
                    <th className="text-right font-medium px-4 py-3">سطح</th>
                    <th className="text-right font-medium px-4 py-3">وضعیت</th>
                    <th className="text-center font-medium px-4 py-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {chartAccounts.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-700" dir="ltr">{a.code}</td>
                      <td className="px-4 py-3 text-gray-700">{a.name}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${chartAcctTypeColors[a.account_type] || 'bg-gray-50 text-gray-500'}`}>{chartAcctTypeLabels[a.account_type] || a.account_type}</span></td>
                      <td className="px-4 py-3 text-gray-500">{a.level.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${a.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>{a.is_active ? 'فعال' : 'غیرفعال'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => onEditChart(a)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => onDeleteChart(a.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Journal Tab
// ============================================================
function JournalTab({ entries, chartAccounts, onAdd, onDelete }: {
  entries: JournalEntry[];
  chartAccounts: ChartAccount[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">سندهای دفتر روزنامه (۵۰ مورد اخیر)</p>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
          <Plus className="w-4 h-4" /><span>سند جدید</span>
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">سندی ثبت نشده است</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-gray-400 text-xs">
                  <th className="text-right font-medium px-4 py-3">شماره</th>
                  <th className="text-right font-medium px-4 py-3">تاریخ</th>
                  <th className="text-right font-medium px-4 py-3">شرح</th>
                  <th className="text-right font-medium px-4 py-3">بدهکار</th>
                  <th className="text-right font-medium px-4 py-3">بستانکار</th>
                  <th className="text-right font-medium px-4 py-3">مبلغ</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-700" dir="ltr">{e.entry_number}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(e.entry_date).toLocaleDateString('fa-IR')}</td>
                    <td className="px-4 py-3 text-gray-600">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.debit_account?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.credit_account?.name || '—'}</td>
                    <td className="px-4 py-3 font-bold text-gray-800" dir="ltr">{Math.round(Number(e.amount)).toLocaleString('fa-IR')} ت</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => onDelete(e.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
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
// Budgets Tab
// ============================================================
function BudgetsTab({ budgets, onAdd, onEdit, onDelete }: {
  budgets: Budget[];
  onAdd: () => void;
  onEdit: (b: Budget) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">بودجه‌ریزی دوره‌ای</p>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
          <Plus className="w-4 h-4" /><span>بودجه جدید</span>
        </button>
      </div>
      {budgets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
          <PiggyBank className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">هنوز بودجه‌ای تعریف نشده است</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <PiggyBank className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{b.name}</h4>
                    <p className="text-xs text-gray-400">{budgetPeriodLabels[b.period_type] || b.period_type}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-xs text-gray-400">بودجه درآمد</p>
                  <p className="text-sm font-bold text-emerald-600" dir="ltr">{Math.round(Number(b.revenue_budget)).toLocaleString('fa-IR')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">بودجه هزینه</p>
                  <p className="text-sm font-bold text-red-600" dir="ltr">{Math.round(Number(b.expense_budget)).toLocaleString('fa-IR')}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{new Date(b.period_start).toLocaleDateString('fa-IR')} تا {new Date(b.period_end).toLocaleDateString('fa-IR')}</p>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => onEdit(b)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600"><Edit3 className="w-3.5 h-3.5" /><span>ویرایش</span></button>
                <button onClick={() => onDelete(b.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /><span>حذف</span></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Financial Account Modal
// ============================================================
function FinAccountModal({ account, onClose, onSaved }: {
  account: FinancialAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: account?.name || '',
    account_type: account?.account_type || 'cash',
    bank_name: account?.bank_name || '',
    bank_branch: account?.bank_branch || '',
    account_number: account?.account_number || '',
    card_number: account?.card_number || '',
    iban: account?.iban || '',
    opening_balance: account?.opening_balance ?? 0,
    is_active: account?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = {
      ...form,
      bank_name: form.bank_name || null,
      bank_branch: form.bank_branch || null,
      account_number: form.account_number || null,
      card_number: form.card_number || null,
      iban: form.iban || null,
      opening_balance: Number(form.opening_balance),
      current_balance: account ? undefined : Number(form.opening_balance),
    };
    const { error: err } = account
      ? await supabase.from('financial_accounts').update(payload).eq('id', account.id)
      : await supabase.from('financial_accounts').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-800">{account ? 'ویرایش حساب' : 'حساب مالی جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام حساب <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع حساب</label>
            <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} className="modal-input">
              {Object.entries(finAcctTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {form.account_type === 'bank' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">نام بانک</label>
                  <input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="modal-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">شعبه</label>
                  <input type="text" value={form.bank_branch} onChange={e => setForm({ ...form, bank_branch: e.target.value })} className="modal-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">شماره حساب</label>
                  <input type="text" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} dir="ltr" className="modal-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">شماره کارت</label>
                  <input type="text" value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} dir="ltr" className="modal-input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">شبا (IBAN)</label>
                <input type="text" value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} dir="ltr" className="modal-input" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">موجودی ابتدایی (تومان)</label>
            <input type="number" value={form.opening_balance || ''} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" placeholder="0" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-gray-600">فعال</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Chart Account Modal
// ============================================================
function ChartAccountModal({ account, onClose, onSaved }: {
  account: ChartAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: account?.code || '',
    name: account?.name || '',
    account_type: account?.account_type || 'asset',
    level: account?.level ?? 1,
    is_active: account?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = { ...form, level: Number(form.level) };
    const { error: err } = account
      ? await supabase.from('chart_accounts').update(payload).eq('id', account.id)
      : await supabase.from('chart_accounts').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{account ? 'ویرایش حساب' : 'حساب دفتر کل جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">کد <span className="text-red-400">*</span></label>
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required dir="ltr" className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">سطح</label>
              <input type="number" value={form.level} onChange={e => setForm({ ...form, level: Number(e.target.value) })} min="1" dir="ltr" className="modal-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع حساب</label>
            <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} className="modal-input">
              {Object.entries(chartAcctTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-gray-600">فعال</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Journal Modal
// ============================================================
function JournalModal({ chartAccounts, profile, onClose, onSaved }: {
  chartAccounts: ChartAccount[];
  profile: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    entry_number: '',
    entry_date: new Date().toISOString().slice(0, 10),
    description: '',
    debit_account_id: '',
    credit_account_id: '',
    amount: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    if (form.amount <= 0) { setError('مبلغ باید بزرگتر از صفر باشد'); setSaving(false); return; }
    if (!form.debit_account_id || !form.credit_account_id) { setError('حساب بدهکار و بستانکار الزامی است'); setSaving(false); return; }

    const { error: err } = await supabase.from('journal_entries').insert({
      entry_number: form.entry_number || `JE-${Date.now()}`,
      entry_date: new Date(form.entry_date).toISOString(),
      description: form.description || null,
      debit_account_id: form.debit_account_id,
      credit_account_id: form.credit_account_id,
      amount: Number(form.amount),
      created_by: profile?.id || null,
    });
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">سند دفتر روزنامه</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">شماره سند</label>
            <input type="text" value={form.entry_number} onChange={e => setForm({ ...form, entry_number: e.target.value })} dir="ltr" className="modal-input" placeholder="خودکار تولید می‌شود" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ</label>
            <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} dir="ltr" className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">حساب بدهکار <span className="text-red-400">*</span></label>
            <select value={form.debit_account_id} onChange={e => setForm({ ...form, debit_account_id: e.target.value })} className="modal-input">
              <option value="">انتخاب...</option>
              {chartAccounts.filter(a => a.is_active).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">حساب بستانکار <span className="text-red-400">*</span></label>
            <select value={form.credit_account_id} onChange={e => setForm({ ...form, credit_account_id: e.target.value })} className="modal-input">
              <option value="">انتخاب...</option>
              {chartAccounts.filter(a => a.is_active).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">مبلغ (تومان) <span className="text-red-400">*</span></label>
            <input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">شرح</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="modal-input" placeholder="اختیاری" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ثبت سند</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Budget Modal
// ============================================================
function BudgetModal({ budget, onClose, onSaved }: {
  budget: Budget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: budget?.name || '',
    period_type: budget?.period_type || 'monthly',
    period_start: budget?.period_start ? budget.period_start.slice(0, 10) : '',
    period_end: budget?.period_end ? budget.period_end.slice(0, 10) : '',
    revenue_budget: budget?.revenue_budget ?? 0,
    expense_budget: budget?.expense_budget ?? 0,
    notes: budget?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    if (!form.period_start || !form.period_end) { setError('تاریخ شروع و پایان الزامی است'); setSaving(false); return; }
    const payload = {
      name: form.name,
      period_type: form.period_type,
      period_start: form.period_start,
      period_end: form.period_end,
      revenue_budget: Number(form.revenue_budget),
      expense_budget: Number(form.expense_budget),
      notes: form.notes || null,
    };
    const { error: err } = budget
      ? await supabase.from('budgets').update(payload).eq('id', budget.id)
      : await supabase.from('budgets').insert(payload);
    if (err) { setError(err.message); setSaving(false); }
    else onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{budget ? 'ویرایش بودجه' : 'بودجه جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نام <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="modal-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع دوره</label>
            <select value={form.period_type} onChange={e => setForm({ ...form, period_type: e.target.value })} className="modal-input">
              {Object.entries(budgetPeriodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">شروع دوره</label>
              <input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} dir="ltr" className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">پایان دوره</label>
              <input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} dir="ltr" className="modal-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">بودجه درآمد (تومان)</label>
              <input type="number" value={form.revenue_budget || ''} onChange={e => setForm({ ...form, revenue_budget: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">بودجه هزینه (تومان)</label>
              <input type="number" value={form.expense_budget || ''} onChange={e => setForm({ ...form, expense_budget: Number(e.target.value) })} min="0" dir="ltr" className="modal-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">یادداشت</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="modal-input" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
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
