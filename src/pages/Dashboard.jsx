import { useAuth } from '@/auth/AuthContext.jsx';
import GlobalOverview from './GlobalOverview.jsx';
import TeamDashboard from './TeamDashboard.jsx';

/** Picks the right dashboard for the signed-in account's scope — GLOBAL
 *  (Super Admin) gets the platform-wide overview, CITY/DEALERSHIP-scoped
 *  accounts (City Admin, Dealership Manager) get their own hierarchy-shaped
 *  view. Same route, same DASHBOARD permission — see App.jsx. */
export default function Dashboard() {
  const { user } = useAuth();
  return user?.scopeType === 'GLOBAL' ? <GlobalOverview /> : <TeamDashboard />;
}
