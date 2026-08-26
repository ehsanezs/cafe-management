import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  UtensilsCrossed, LogOut, LayoutDashboard, ShoppingCart, Package,
  Users, Settings, FileBarChart, ChefHat, Receipt, Store, ClipboardList,
  Wallet, TrendingUp, Bell, Menu, X, Truck, Brain, Star
} from 'lucide-react';
import { ProductsPage } from '@/pages/ProductsPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { POSPage } from '@/pages/POSPage';
import { TablesPage } from '@/pages/TablesPage';
import { KitchenPage } from '@/pages/KitchenPage';
import { AccountingPage } from '@/pages/AccountingPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SurveyPage } from '@/pages/SurveyPage';
import { MenuEngineeringPage } from '@/pages/MenuEngineeringPage';

type NavItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: string;
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, module: 'dashboard' },
  { id: 'pos', label: 'صندوق فروش', icon: ShoppingCart, module: 'pos' },
  { id: 'tables', label: 'مدیریت سالن', icon: Store, module: 'pos' },
  { id: 'kitchen', label: 'آشپزخانه', icon: ChefHat, module: 'pos' },
  { id: 'products', label: 'محصولات و رسپی', icon: Package, module: 'products' },
  { id: 'inventory', label: 'انبار', icon: ClipboardList, module: 'inventory' },
  { id: 'purchases', label: 'سفارشات خرید', icon: Receipt, module: 'purchase' },
  { id: 'suppliers', label: 'تأمین‌کنندگان', icon: Truck, module: 'purchase' },
  { id: 'customers', label: 'مشتریان', icon: Users, module: 'crm' },
  { id: 'accounting', label: 'حسابداری', icon: Wallet, module: 'accounting' },
  { id: 'reports', label: 'گزارش‌ها', icon: FileBarChart, module: 'reports' },
  { id: 'menu-eng', label: 'مهندسی منو', icon: Brain, module: 'reports' },
  { id: 'surveys', label: 'نظرسنجی', icon: Star, module: 'crm' },
  { id: 'settings', label: 'تنظیمات', icon: Settings, module: 'settings' },
];

export function DashboardPage() {
  const { user, profile, roles, signOut } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState<string>('کافه‌رستوران');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('settings')
        .select('restaurant_name')
        .is('branch_id', null)
        .maybeSingle();
      if (data?.restaurant_name) setRestaurantName(data.restaurant_name);
    })();
  }, []);

  const primaryRole = roles[0];
  const displayName = profile?.full_name || user?.email || 'کاربر';

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-72 bg-white border-l border-gray-100 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-50">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-orange-100">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 truncate max-w-[160px]">{restaurantName}</h2>
              <p className="text-xs text-gray-400">سیستم مدیریت</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden mr-auto p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-l from-amber-500 to-orange-600 text-white shadow-md shadow-orange-100'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User */}
          <div className="border-t border-gray-50 px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm">
                {displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
                <p className="text-xs text-gray-400 truncate">
                  {primaryRole?.role_display_name || 'بدون نقش'}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج از سیستم</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                {navItems.find(n => n.id === activeView)?.label || 'داشبورد'}
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                {new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {activeView === 'dashboard' && <DashboardHome />}
          {activeView === 'pos' && <POSPage />}
          {activeView === 'tables' && <TablesPage />}
          {activeView === 'kitchen' && <KitchenPage />}
          {activeView === 'products' && <ProductsPage />}
          {activeView === 'inventory' && <InventoryPage />}
          {activeView === 'purchases' && <PurchaseOrdersPage />}
          {activeView === 'suppliers' && <SuppliersPage />}
          {activeView === 'accounting' && <AccountingPage />}
          {activeView === 'customers' && <CustomersPage />}
          {activeView === 'reports' && <ReportsPage />}
          {activeView === 'menu-eng' && <MenuEngineeringPage />}
          {activeView === 'surveys' && <SurveyPage />}
          {activeView === 'settings' && <SettingsPage />}
          {!['dashboard', 'pos', 'tables', 'kitchen', 'products', 'inventory', 'purchases', 'suppliers', 'accounting', 'customers', 'reports', 'menu-eng', 'surveys', 'settings'].includes(activeView) && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                {(() => {
                  const item = navItems.find(n => n.id === activeView);
                  const Icon = item?.icon || Package;
                  return <Icon className="w-8 h-8 text-amber-400" />;
                })()}
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                {navItems.find(n => n.id === activeView)?.label}
              </h3>
              <p className="text-sm text-gray-400 max-w-md">
                این بخش در فازهای بعدی پیاده‌سازی خواهد شد. ساختار پایه و آماده‌سازی انجام شده است.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DashboardHome() {
  const { profile, roles } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    branches: 0,
    rolesAssigned: 0,
  });

  useEffect(() => {
    (async () => {
      const [{ count: users }, { count: branches }, { count: roleAssigns }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('branches').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        users: users || 0,
        branches: branches || 0,
        rolesAssigned: roleAssigns || 0,
      });
    })();
  }, []);

  const cards = [
    { label: 'کاربران فعال', value: stats.users, icon: Users, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
    { label: 'شعبه‌ها', value: stats.branches, icon: Store, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50' },
    { label: 'نقش‌های اختصاص‌یافته', value: stats.rolesAssigned, icon: ClipboardList, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-l from-amber-500 to-orange-600 rounded-2xl p-6 lg:p-8 text-white shadow-lg shadow-orange-100">
        <h2 className="text-xl lg:text-2xl font-bold mb-1">
          خوش آمدید، {profile?.full_name || 'کاربر'}
        </h2>
        <p className="text-amber-50 text-sm">
          {roles.length > 0
            ? `نقش شما: ${roles.map(r => r.role_display_name).join('، ')}`
            : 'نقشی به شما اختصاص داده نشده است. از مدیر سیستم بخواهید نقش شما را تعیین کند.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 bg-gradient-to-br ${card.color} bg-clip-text`} style={{ color: card.color.includes('amber') ? '#f59e0b' : card.color.includes('blue') ? '#3b82f6' : '#10b981' }} />
                </div>
                <span className="text-3xl font-bold text-gray-800">{card.value}</span>
              </div>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Phase 1 Status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-800">وضعیت سیستم — همه فازها</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'احراز هویت و ورود کاربران', done: true },
            { label: 'مدیریت نقش‌ها و دسترسی‌ها (RBAC)', done: true },
            { label: 'شعبه‌ها و تنظیمات', done: true },
            { label: 'سیستم شماره‌گذاری اسناد', done: true },
            { label: 'ثبت عملیات حساس (Audit Log)', done: true },
            { label: 'محصولات و رسپی نسخه‌دار', done: true },
            { label: 'انبار و خرید', done: true },
            { label: 'POS و مدیریت میز', done: true },
            { label: 'حسابداری و صندوق', done: true },
            { label: 'CRM و باشگاه مشتریان', done: true },
            { label: 'گزارش‌ها و داشبورد مدیریت', done: true },
            { label: 'آفلاین و همگام‌سازی', done: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                item.done
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-gray-50 text-gray-400'
              }`}>
                {item.done ? 'تکمیل شده' : 'در انتظار'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
