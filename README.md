# Admin Panel

New admin panel for the wheely backend. Companion to the consumer Flutter app
(`testf/`) and partner portal (`asteronX/`). Replaces the legacy
`VgoAdminPannel/` (left untouched for now).

## Stack

- **Vite** + **React 19** (JSX, no TypeScript)
- **Tailwind CSS 3** with an indigo-seeded `brand` palette
- **React Router 7** for routing
- **Axios** for HTTP, with a JWT bearer interceptor and 401-refresh stub
- **lucide-react** for icons

## Getting started

```bash
cd admin_panel
npm install
cp .env.example .env       # set VITE_API_BASE_URL to your backend
npm run dev
```

Default dev port: **5174** (so it can run alongside the legacy panel on 5173).

## Current state

This is a **dummy structure** — UI shell + navigation + page stubs. The login
form accepts any credentials and routes you to the dashboard via a fake JWT
in `localStorage`. Real API wiring is added section-by-section, starting from
`src/api/endpoints.js` (which already enumerates every backend admin route).

## Layout

```
src/
├── api/             axios client + endpoints.js (mirrors backend)
├── auth/            AuthContext + ProtectedRoute
├── components/ui/   Button, Card, Input, PageHeader, EmptyState, Skeleton
├── layouts/         AdminLayout (sidebar + topbar + outlet)
├── lib/             cn() utility
└── pages/           Login + Dashboard + 12 section pages
```

## Pages map → backend admin endpoints

| Page | Backend prefix |
|---|---|
| Dashboard | `/admin/dashboard/` |
| Vehicles | `/admin/vehicle/` |
| Used Vehicles | `/admin/used/vehicle/` |
| Brands | `/admin/brand/` |
| Cities | `/admin/city/` |
| Leads | `/admin/leads/` |
| External Leads | `/admin/extLeads/` |
| Sales | `/admin/sales/` |
| Finance | `/admin/finance/` |
| Partners | `/admin/partners/` |
| Users | `/admin/manage/` |
| Reviews | `/admin/review/` |
| Notifications | `/admin/firebase/notifications/` |
| Feature Flags | `/admin/app-config/` |

## Implementation order (planned)

1. ✅ Skeleton + nav + dummy auth (this commit)
2. Real admin login + JWT refresh
3. Dashboard stats
4. Master data (Brands, Cities)
5. Vehicles + Used Vehicles
6. Leads + External Leads + Sales
7. Partners + Users + Reviews
8. Notifications + Feature Flags
