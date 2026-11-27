import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout.jsx';
import { ProtectedRoute, RequirePermission } from './auth/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import Dashboard from './pages/Dashboard.jsx';
import VehiclesList from './pages/vehicles/VehiclesList.jsx';
import PriceReview from './pages/vehicles/PriceReview.jsx';
import UsedVehiclesList from './pages/vehicles/UsedVehiclesList.jsx';
import FeaturedVehiclesList from './pages/featured/FeaturedVehiclesList.jsx';
import VideosManager from './pages/videos/VideosManager.jsx';
import BrandsManager from './pages/brands/BrandsManager.jsx';
import CitiesManager from './pages/cities/CitiesManager.jsx';
import LeadsList from './pages/leads/LeadsList.jsx';
import ExternalLeadsList from './pages/leads/ExternalLeadsList.jsx';
import SalesList from './pages/sales/SalesList.jsx';
import MyEarnings from './pages/MyEarnings.jsx';
import FinanceList from './pages/finance/FinanceList.jsx';
import LoanLeadsList from './pages/loans/LoanLeadsList.jsx';
import InterestAbandonmentList from './pages/leads/InterestAbandonmentList.jsx';
import PartnersList from './pages/partners/PartnersList.jsx';
import UsersList from './pages/users/UsersList.jsx';
import ReviewsList from './pages/reviews/ReviewsList.jsx';
import NotificationsManager from './pages/notifications/NotificationsManager.jsx';
import HomeBannersManager from './pages/home-banners/HomeBannersManager.jsx';
import OffersManager from './pages/offers/OffersManager.jsx';
import FeatureFlags from './pages/settings/FeatureFlags.jsx';
import ContactInfo from './pages/settings/ContactInfo.jsx';
import Sessions from './pages/settings/Sessions.jsx';
import StaffManager from './pages/staff/StaffManager.jsx';
import RolesManager from './pages/roles/RolesManager.jsx';
import DealershipsManager from './pages/dealerships/DealershipsManager.jsx';
import ServerHealth from './pages/system/ServerHealth.jsx';
import SearchInsights from './pages/search/SearchInsights.jsx';

// Every page is wrapped in RequirePermission for its AdminModule (mirrors the
// backend's AdminModule enum + @RequiresPermission — see RoleController /
// PermissionAspect in niku_repo). The backend is the real boundary; this only
// keeps a scoped staff member from landing on a page that would immediately
// 403 on every request it fires.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RequirePermission module="DASHBOARD"><Dashboard /></RequirePermission>} />
        <Route path="/vehicles" element={<RequirePermission module="VEHICLES"><VehiclesList /></RequirePermission>} />
        <Route path="/price-review" element={<RequirePermission module="PRICE_REVIEW"><PriceReview /></RequirePermission>} />
        <Route path="/used-vehicles" element={<RequirePermission module="USED_VEHICLES"><UsedVehiclesList /></RequirePermission>} />
        <Route path="/featured-vehicles" element={<RequirePermission module="FEATURED_VEHICLES"><FeaturedVehiclesList /></RequirePermission>} />
        <Route path="/videos" element={<RequirePermission module="VIDEOS"><VideosManager /></RequirePermission>} />
        <Route path="/brands" element={<RequirePermission module="BRANDS"><BrandsManager /></RequirePermission>} />
        <Route path="/cities" element={<RequirePermission module="CITIES"><CitiesManager /></RequirePermission>} />
        <Route path="/leads" element={<RequirePermission module="LEADS"><LeadsList /></RequirePermission>} />
        <Route path="/external-leads" element={<RequirePermission module="EXTERNAL_LEADS"><ExternalLeadsList /></RequirePermission>} />
        <Route path="/sales" element={<RequirePermission module="SALES"><SalesList /></RequirePermission>} />
        {/* Self-service, no module gate — every staff role sees their own commission. */}
        <Route path="/my-earnings" element={<MyEarnings />} />
        <Route path="/dealerships" element={<RequirePermission module="DEALERSHIPS"><DealershipsManager /></RequirePermission>} />
        <Route path="/staff" element={<RequirePermission module="STAFF"><StaffManager /></RequirePermission>} />
        <Route path="/roles" element={<RequirePermission module="ROLES"><RolesManager /></RequirePermission>} />
        <Route path="/loan-leads" element={<RequirePermission module="LOANS"><LoanLeadsList /></RequirePermission>} />
        <Route path="/interest-nudges" element={<RequirePermission module="INTEREST_NUDGES"><InterestAbandonmentList /></RequirePermission>} />
        <Route path="/finance" element={<RequirePermission module="FINANCE"><FinanceList /></RequirePermission>} />
        <Route path="/partners" element={<RequirePermission module="PARTNERS"><PartnersList /></RequirePermission>} />
        <Route path="/users" element={<RequirePermission module="USERS"><UsersList /></RequirePermission>} />
        <Route path="/reviews" element={<RequirePermission module="REVIEWS"><ReviewsList /></RequirePermission>} />
        <Route path="/notifications" element={<RequirePermission module="NOTIFICATIONS"><NotificationsManager /></RequirePermission>} />
        <Route path="/home-banners" element={<RequirePermission module="HOME_BANNERS"><HomeBannersManager /></RequirePermission>} />
        <Route path="/offers" element={<RequirePermission module="OFFERS"><OffersManager /></RequirePermission>} />
        <Route path="/feature-flags" element={<RequirePermission module="FEATURE_FLAGS"><FeatureFlags /></RequirePermission>} />
        <Route path="/contact-info" element={<RequirePermission module="CONTACT_INFO"><ContactInfo /></RequirePermission>} />
        <Route path="/server-health" element={<RequirePermission module="SERVER_HEALTH"><ServerHealth /></RequirePermission>} />
        <Route path="/search-insights" element={<RequirePermission module="SEARCH_INSIGHTS"><SearchInsights /></RequirePermission>} />
        <Route path="/sessions" element={<RequirePermission module="SESSIONS"><Sessions /></RequirePermission>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
