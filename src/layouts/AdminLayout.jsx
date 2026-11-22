import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgePercent,
  Bike,
  Building2,
  ChartLine,
  ChevronRight,
  ClipboardList,
  Coins,
  HandCoins,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  PhoneCall,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  Users,
  Video,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

// Single source of truth for nav. `module` is the AdminModule this item is
// gated on (mirrors the backend enum exactly — see niku_repo's AdminModule);
// an item shows only when the signed-in account can view that module
// (AuthContext.can, resolved from the login response's permission map, with
// ADMIN/bypass-all short-circuiting to "see everything").
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'DASHBOARD' }],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/vehicles', label: 'Vehicles', icon: Bike, module: 'VEHICLES' },
      { to: '/price-review', label: 'Price Review', icon: AlertTriangle, badge: 'stalePrices', module: 'PRICE_REVIEW' },
      { to: '/used-vehicles', label: 'Used Vehicles', icon: Bike, module: 'USED_VEHICLES' },
      { to: '/featured-vehicles', label: 'Featured', icon: Sparkles, module: 'FEATURED_VEHICLES' },
      { to: '/videos', label: 'Videos', icon: Video, module: 'VIDEOS' },
      { to: '/brands', label: 'Brands', icon: Tags, module: 'BRANDS' },
      { to: '/cities', label: 'Cities', icon: Building2, module: 'CITIES' },
    ],
  },
  {
    label: 'Leads & Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: ClipboardList, module: 'LEADS' },
      { to: '/external-leads', label: 'External Leads', icon: ClipboardList, module: 'EXTERNAL_LEADS' },
      { to: '/sales', label: 'Sales', icon: ChartLine, module: 'SALES' },
      // Self-service commission view — every staff role has this,
      // regardless of module permissions (see App.jsx's /my-earnings route).
      { to: '/my-earnings', label: 'My Earnings', icon: Coins, alwaysVisible: true },
      { to: '/loan-leads', label: 'Loan Leads', icon: Wallet, module: 'LOANS' },
      { to: '/interest-nudges', label: 'Interest Nudges', icon: MessageSquare, module: 'INTEREST_NUDGES' },
      { to: '/finance', label: 'Finance', icon: HandCoins, module: 'FINANCE' },
    ],
  },
  {
    label: 'Network',
    items: [
      { to: '/dealerships', label: 'Dealerships', icon: Building2, module: 'DEALERSHIPS' },
      { to: '/staff', label: 'Staff', icon: ShieldCheck, module: 'STAFF' },
      { to: '/roles', label: 'Roles & Permissions', icon: ShieldCheck, module: 'ROLES' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users, module: 'USERS' },
      { to: '/partners', label: 'Partners', icon: Users, module: 'PARTNERS' },
      { to: '/reviews', label: 'Reviews', icon: Star, module: 'REVIEWS' },
    ],
  },
  {
    label: 'Comms',
    items: [
      { to: '/home-banners', label: 'Home Banners', icon: ImageIcon, module: 'HOME_BANNERS' },
      { to: '/offers', label: 'Offers', icon: BadgePercent, module: 'OFFERS' },
      { to: '/notifications', label: 'Notifications', icon: Megaphone, module: 'NOTIFICATIONS' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/feature-flags', label: 'Feature Flags', icon: Settings2, module: 'FEATURE_FLAGS' },
      { to: '/contact-info', label: 'Contact Us', icon: PhoneCall, module: 'CONTACT_INFO' },
      { to: '/server-health', label: 'Server Health', icon: Activity, module: 'SERVER_HEALTH' },
      { to: '/sessions', label: 'Sessions', icon: MonitorSmartphone, module: 'SESSIONS' },
    ],
  },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent />
      </aside>

      {/* Sidebar (mobile) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const { can } = useAuth();
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.alwaysVisible || can(item.module, 'view')),
  })).filter((group) => group.items.length > 0);

  const canSeeStalePrices = can('PRICE_REVIEW', 'view');

  // Badge counts, keyed to match each nav item's `badge` field. Refetched
  // every 5 minutes — this only ever changes via a Sunday scheduled job or
  // an admin action on the Price Review page itself, so anything faster
  // would just be wasted polling.
  const [badgeCounts, setBadgeCounts] = useState({});
  useEffect(() => {
    if (!canSeeStalePrices) return;
    let cancelled = false;
    function refresh() {
      VehiclesApi.getStalePriceCount()
        .then((resp) => {
          if (cancelled) return;
          if (resp?.data?.status === 'SUCCESS') {
            setBadgeCounts((prev) => ({ ...prev, stalePrices: resp.data.data }));
          }
        })
        .catch(() => {
          // badge is non-critical chrome — silent
        });
    }
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canSeeStalePrices]);

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">Wheely</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Admin Console
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-700 hover:bg-slate-100',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isActive
                              ? 'text-brand-600'
                              : 'text-slate-400 group-hover:text-slate-600',
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && badgeCounts[item.badge] > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                            {badgeCounts[item.badge] > 99
                              ? '99+'
                              : badgeCounts[item.badge]}
                          </span>
                        )}
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 text-brand-500" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
        v0.0.1 · Connected to <code className="font-semibold">/wheely</code>
      </div>
    </>
  );
}

function Topbar({ onOpenMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
          aria-label="Messages"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-slate-900">
              {user?.name ?? 'Admin'}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              {user?.accessRoleName ?? 'Admin'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
