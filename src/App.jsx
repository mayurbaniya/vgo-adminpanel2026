import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { useAuth } from './auth/AuthContext.jsx';

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
import LoanLeadsList from './pages/loans/LoanLeadsList.jsx';
import PartnersList from './pages/partners/PartnersList.jsx';
import UsersList from './pages/users/UsersList.jsx';
import ReviewsList from './pages/reviews/ReviewsList.jsx';
import NotificationsManager from './pages/notifications/NotificationsManager.jsx';
import HomeBannersManager from './pages/home-banners/HomeBannersManager.jsx';
import OffersManager from './pages/offers/OffersManager.jsx';
import FeatureFlags from './pages/settings/FeatureFlags.jsx';
import ContactInfo from './pages/settings/ContactInfo.jsx';
import StaffManager from './pages/staff/StaffManager.jsx';
import DealershipsManager from './pages/dealerships/DealershipsManager.jsx';

// Scoped staff (CITY_MANAGER / SALES_EXEC) only get the leads/sales
// workspace — every other page is super-admin only and bounces them to
// /leads, mirroring the backend's SecurityConfig split.
function SuperOnly({ children }) {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? children : <Navigate to="/leads" replace />;
}

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
        <Route path="/dashboard" element={<SuperOnly><Dashboard /></SuperOnly>} />
        <Route path="/vehicles" element={<SuperOnly><VehiclesList /></SuperOnly>} />
        <Route path="/used-vehicles" element={<SuperOnly><UsedVehiclesList /></SuperOnly>} />
        <Route path="/featured-vehicles" element={<SuperOnly><FeaturedVehiclesList /></SuperOnly>} />
        <Route path="/brands" element={<SuperOnly><BrandsManager /></SuperOnly>} />
        <Route path="/cities" element={<SuperOnly><CitiesManager /></SuperOnly>} />
        <Route path="/leads" element={<LeadsList />} />
        <Route path="/external-leads" element={<SuperOnly><ExternalLeadsList /></SuperOnly>} />
        <Route path="/sales" element={<SalesList />} />
        <Route path="/dealerships" element={<DealershipsManager />} />
        <Route path="/staff" element={<SuperOnly><StaffManager /></SuperOnly>} />
        <Route path="/loan-leads" element={<SuperOnly><LoanLeadsList /></SuperOnly>} />
        <Route path="/finance" element={<SuperOnly><FinanceList /></SuperOnly>} />
        <Route path="/partners" element={<SuperOnly><PartnersList /></SuperOnly>} />
        <Route path="/users" element={<SuperOnly><UsersList /></SuperOnly>} />
        <Route path="/reviews" element={<SuperOnly><ReviewsList /></SuperOnly>} />
        <Route path="/notifications" element={<SuperOnly><NotificationsManager /></SuperOnly>} />
        <Route path="/home-banners" element={<SuperOnly><HomeBannersManager /></SuperOnly>} />
        <Route path="/offers" element={<SuperOnly><OffersManager /></SuperOnly>} />
        <Route path="/feature-flags" element={<SuperOnly><FeatureFlags /></SuperOnly>} />
        <Route path="/contact-info" element={<SuperOnly><ContactInfo /></SuperOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
