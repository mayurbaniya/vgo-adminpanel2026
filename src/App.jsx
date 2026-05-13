import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import VehiclesList from './pages/vehicles/VehiclesList.jsx';
import UsedVehiclesList from './pages/vehicles/UsedVehiclesList.jsx';
import FeaturedVehiclesList from './pages/featured/FeaturedVehiclesList.jsx';
import BrandsManager from './pages/brands/BrandsManager.jsx';
import CitiesManager from './pages/cities/CitiesManager.jsx';
import LeadsList from './pages/leads/LeadsList.jsx';
import ExternalLeadsList from './pages/leads/ExternalLeadsList.jsx';
import SalesList from './pages/sales/SalesList.jsx';
import FinanceList from './pages/finance/FinanceList.jsx';
import PartnersList from './pages/partners/PartnersList.jsx';
import UsersList from './pages/users/UsersList.jsx';
import ReviewsList from './pages/reviews/ReviewsList.jsx';
import NotificationsManager from './pages/notifications/NotificationsManager.jsx';
import FeatureFlags from './pages/settings/FeatureFlags.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vehicles" element={<VehiclesList />} />
        <Route path="/used-vehicles" element={<UsedVehiclesList />} />
        <Route path="/featured-vehicles" element={<FeaturedVehiclesList />} />
        <Route path="/brands" element={<BrandsManager />} />
        <Route path="/cities" element={<CitiesManager />} />
        <Route path="/leads" element={<LeadsList />} />
        <Route path="/external-leads" element={<ExternalLeadsList />} />
        <Route path="/sales" element={<SalesList />} />
        <Route path="/finance" element={<FinanceList />} />
        <Route path="/partners" element={<PartnersList />} />
        <Route path="/users" element={<UsersList />} />
        <Route path="/reviews" element={<ReviewsList />} />
        <Route path="/notifications" element={<NotificationsManager />} />
        <Route path="/feature-flags" element={<FeatureFlags />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
