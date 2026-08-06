import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BadgePercent,
  Bike,
  Building2,
  ChartLine,
  ChevronRight,
  ClipboardList,
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
import { cn } from '@/lib/cn';

// Single source of truth for nav. Editing here updates sidebar + topbar
// breadcrumb + (eventually) command-K search. Items marked `staffAccess`
// are visible to scoped staff (CITY_MANAGER / SALES_EXEC) — everything else
// is super-admin only, mirroring the backend SecurityConfig split.
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/vehicles', label: 'Vehicles', icon: Bike },
      { to: '/used-vehicles', label: 'Used Vehicles', icon: Bike },
      { to: '/featured-vehicles', label: 'Featured', icon: Sparkles },
      { to: '/videos', label: 'Videos', icon: Video },
      { to: '/brands', label: 'Brands', icon: Tags },
      { to: '/cities', label: 'Cities', icon: Building2 },
    ],
  },
  {
    label: 'Leads & Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: ClipboardList, staffAccess: true },
      { to: '/external-leads', label: 'External Leads', icon: ClipboardList },
      { to: '/sales', label: 'Sales', icon: ChartLine, staffAccess: true },
      { to: '/loan-leads', label: 'Loan Leads', icon: Wallet },
      { to: '/finance', label: 'Finance', icon: HandCoins },
    ],
  },
  {
    label: 'Network',
    items: [
      { to: '/dealerships', label: 'Dealerships', icon: Building2, staffAccess: true },
      { to: '/staff', label: 'Staff', icon: ShieldCheck },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/partners', label: 'Partners', icon: Users },
      { to: '/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    label: 'Comms',
    items: [
      { to: '/home-banners', label: 'Home Banners', icon: ImageIcon },
      { to: '/offers', label: 'Offers', icon: BadgePercent },
      { to: '/notifications', label: 'Notifications', icon: Megaphone },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/feature-flags', label: 'Feature Flags', icon: Settings2 },
      { to: '/contact-info', label: 'Contact Us', icon: PhoneCall },
      { to: '/server-health', label: 'Server Health', icon: Activity },
      { to: '/sessions', label: 'Sessions', icon: MonitorSmartphone },
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
  const { isSuperAdmin } = useAuth();
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: isSuperAdmin
      ? group.items
      : group.items.filter((item) => item.staffAccess),
  })).filter((group) => group.items.length > 0);

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
              {user?.role ?? 'ADMIN'}
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
