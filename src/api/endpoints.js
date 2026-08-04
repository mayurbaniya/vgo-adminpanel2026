/**
 * Admin API surface — mirrors backend `niku_repo` controllers under
 * `com.wheely.controller.admin.*`. Each group is grouped by the controller
 * file's @RequestMapping prefix so wiring a section means picking the
 * matching object here.
 *
 * Status: the **shapes** (paths, params) are real and verified against the
 * backend; nothing is exercised yet beyond the AuthService.login stub. When
 * a section moves from "stub" to "wired", import its group here in the
 * matching page and replace mock data with a real call.
 */

import client from './client';

// -----------------------------------------------------------------------------
// Auth — uses /user/auth/* endpoints with the ADMIN role on the user record.
// Web variant uses an HttpOnly refresh cookie (set by /sign-in/web).
// -----------------------------------------------------------------------------
export const AuthService = {
  login: (data) =>
    client.post('/user/auth/sign-in/web', data, { withCredentials: true }),
  refresh: () =>
    client.post('/user/auth/refresh-token/web', {}, { withCredentials: true }),
  logout: () =>
    client.post('/user/auth/logout/web', {}, { withCredentials: true }),
  createAdmin: (data) => client.post('/user/auth/create-admin', data),
  verifyAdmin: ({ clientID, adminOTP, devOTP }) =>
    client.post('/user/auth/verify-admin', null, {
      params: { clientID, adminOTP, devOTP },
    }),
};

// -----------------------------------------------------------------------------
// /admin/dashboard/  →  StatsController
// -----------------------------------------------------------------------------
export const Dashboard = {
  overview: () => client.get('/admin/dashboard/overview'),
  monthStats: (params) => client.get('/admin/dashboard/month', { params }),
  // Lead funnel, exec leaderboard, city split, lost reasons, action queue,
  // recent audit events.
  pipeline: () => client.get('/admin/dashboard/pipeline'),
};

// -----------------------------------------------------------------------------
// /admin/vehicle/  →  VehicleController
// -----------------------------------------------------------------------------
export const Vehicles = {
  getAll: (params) => client.get('/admin/vehicle/all', { params }),
  getById: (vehicleID) => client.get(`/admin/vehicle/get-by-id/${vehicleID}`),
  getDeleted: () => client.get('/admin/vehicle/deleted-vehicles'),
  getDisabled: () => client.get('/admin/vehicle/disabled-vehicles'),
  getByBrand: (brandID, params) =>
    client.get(`/admin/vehicle/brand/${brandID}`, { params }),
  countSummary: () => client.get('/admin/vehicle/vehicle-count-summary'),
  create: (data) => client.post('/admin/vehicle/create', data),
  update: (vehicleID, data) =>
    client.put('/admin/vehicle/update', data, { params: { vehicleID } }),
  delete: (vehicleID) =>
    client.delete('/admin/vehicle/delete', { params: { vehicleID } }),
  enable: (vehicleID) =>
    client.put('/admin/vehicle/enable', null, { params: { vehicleID } }),
  disable: (vehicleID) =>
    client.put('/admin/vehicle/disable', null, { params: { vehicleID } }),
  changeBrand: (vehicleID, brandID) =>
    client.put('/admin/vehicle/change-brand', null, {
      params: { vehicleID, brandID },
    }),
  // images
  addImages: (vehicleID, formData) =>
    client.post('/admin/vehicle/add-images', formData, {
      params: { vehicleID },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getImages: (vehicleID) => client.get(`/admin/vehicle/images/${vehicleID}`),
  removeImage: (vehicleID, imageURL) =>
    client.delete('/admin/vehicle/remove-image', {
      params: { vehicleID, imageURL },
    }),
  removeAllImages: (vehicleID) =>
    client.delete('/admin/vehicle/remove-all-images', {
      params: { vehicleID },
    }),
  // featured
  getFeatured: () => client.get('/admin/vehicle/featured-vehicle'),
  addFeatured: (vehicleID, priority) =>
    client.post('/admin/vehicle/featured-vehicle', null, {
      params: { vehicleID, priority },
    }),
  removeFeatured: (FVehicleID) =>
    client.delete('/admin/vehicle/featured-vehicle', { params: { FVehicleID } }),
  // Public user-side read (works for any authenticated role) — used to
  // prefill the sale price with the vehicle's on-road price for a city.
  userOnRoadPrice: (vehicleID, cityID) =>
    client.get('/user/vehicle/get-onroadprice', {
      params: { vehicleID, cityID },
    }),
  // dealer commission — admin-only; never present in vehicle payloads.
  getCommission: (vehicleID) =>
    client.get('/admin/vehicle/commission', { params: { vehicleID } }),
  setCommission: (vehicleID, amount) =>
    client.put('/admin/vehicle/commission', null, {
      params: { vehicleID, amount },
    }),
  // on-road price
  getOnRoadPrices: (vehicleID) =>
    client.get('/admin/vehicle/on-road-prices', { params: { vehicleID } }),
  addOnRoadPrice: (data) =>
    client.post('/admin/vehicle/add-on-road-price', null, { params: data }),
  updateOnRoadPrice: (vehiclePriceID, newOnRoadPrice) =>
    client.put('/admin/vehicle/update-on-road-price', null, {
      params: { vehiclePriceID, newOnRoadPrice },
    }),
  // videos
  addVideo: (data) => client.put('/admin/vehicle/video', data),
  getVideos: (vehicleID) =>
    client.get('/admin/vehicle/videos', { params: { vehicleID } }),
  deleteVideo: (vLinkId) =>
    client.delete('/admin/vehicle/video', { params: { vLinkId } }),
  // color variants — soft-migration friendly: list returns EMPTY (data=[])
  // for vehicles that don't have variants yet.
  colorVariants: {
    list: (vehicleID) => client.get(`/admin/vehicle/${vehicleID}/color-variants`),
    create: (vehicleID, data) =>
      client.post(`/admin/vehicle/${vehicleID}/color-variants`, data),
    update: (variantID, data) =>
      client.put(`/admin/vehicle/color-variants/${variantID}`, data),
    remove: (variantID) =>
      client.delete(`/admin/vehicle/color-variants/${variantID}`),
    addImages: (variantID, formData) =>
      client.post(`/admin/vehicle/color-variants/${variantID}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    removeImage: (variantID, imageURL) =>
      client.delete(`/admin/vehicle/color-variants/${variantID}/images`, {
        params: { imageURL },
      }),
  },
};

// -----------------------------------------------------------------------------
// /admin/used/vehicle/  →  UsedVehicleController (path inferred from app)
// -----------------------------------------------------------------------------
export const UsedVehicles = {
  getAll: (params) => client.get('/admin/used/vehicle/all', { params }),
  getById: (vehicleID) =>
    client.get(`/admin/used/vehicle/get-by-id/${vehicleID}`),
  getDeleted: () => client.get('/admin/used/vehicle/deleted-vehicles'),
  getDisabled: () => client.get('/admin/used/vehicle/disabled-vehicles'),
  create: (adminID, data) =>
    client.post('/admin/used/vehicle/create', data, { params: { adminID } }),
  update: (vehicleID, data) =>
    client.put('/admin/used/vehicle/update', data, { params: { vehicleID } }),
  delete: (vehicleID) =>
    client.delete('/admin/used/vehicle/delete', { params: { vehicleID } }),
  enable: (vehicleID) =>
    client.put('/admin/used/vehicle/enable', null, { params: { vehicleID } }),
  disable: (vehicleID) =>
    client.put('/admin/used/vehicle/disable', null, { params: { vehicleID } }),
  addImages: (vehicleID, formData) =>
    client.put('/admin/used/vehicle/add-images', formData, {
      params: { vehicleID },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getImages: (vehicleID) =>
    client.get(`/admin/used/vehicle/images/${vehicleID}`),
  removeImage: (vehicleID, imageURL) =>
    client.delete('/admin/used/vehicle/remove-image', {
      params: { vehicleID, imageURL },
    }),
  removeAllImages: (vehicleID) =>
    client.delete('/admin/used/vehicle/remove-all-images', {
      params: { vehicleID },
    }),
};

// -----------------------------------------------------------------------------
// /admin/brand/  →  BrandController
// -----------------------------------------------------------------------------
export const Brands = {
  getAll: (params) => client.get('/admin/brand/all', { params }),
  getDeleted: () => client.get('/admin/brand/deleted-brands'),
  getDisabled: () => client.get('/admin/brand/disabled-brands'),
  getById: (brandID) =>
    client.get('/admin/brand/brand-by-id', { params: { brandID } }),
  countSummary: () => client.get('/admin/brand/brands-count-summary'),
  add: (brandName) => client.post('/admin/brand/add', null, { params: { brandName } }),
  enable: (brandID) =>
    client.put('/admin/brand/enable', null, { params: { brandID } }),
  disable: (brandID) =>
    client.put('/admin/brand/disable', null, { params: { brandID } }),
  // Popularity rating 1-10; drives the app's home "Popular Brands" grid.
  setRating: (brandID, rating) =>
    client.put('/admin/brand/rating', null, { params: { brandID, rating } }),
  delete: (brandID) =>
    client.delete('/admin/brand/delete', { params: { brandID } }),
  addImage: (brandID, formData) =>
    client.post('/admin/brand/add-image', formData, {
      params: { brandID },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeImage: (brandID) =>
    client.delete('/admin/brand/remove-image', { params: { brandID } }),
};

// -----------------------------------------------------------------------------
// /admin/city/  →  CityControllerAdmin
// -----------------------------------------------------------------------------
export const Cities = {
  getAll: () => client.get('/admin/city/'),
  add: (city) => client.post('/admin/city/', null, { params: { city } }),
  enable: (cityID) =>
    client.put('/admin/city/enable', null, { params: { cityID } }),
  disable: (cityID) =>
    client.put('/admin/city/disable', null, { params: { cityID } }),
};

// -----------------------------------------------------------------------------
// /admin/leads/  →  LeadsController
// Results are scoped server-side by the caller's role (ADMIN all, CITY_MANAGER
// their city, SALES_EXEC their dealership).
// -----------------------------------------------------------------------------
export const Leads = {
  getAll: (params) => client.get('/admin/leads/all', { params }),
  update: (data) => client.put('/admin/leads/update', data),
  assign: (leadID, staffID) =>
    client.put('/admin/leads/assign', null, { params: { leadID, staffID } }),
  events: (leadID) => client.get('/admin/leads/events', { params: { leadID } }),
  assignableStaff: () => client.get('/admin/leads/assignable-staff'),
};

// -----------------------------------------------------------------------------
// /admin/staff/  →  StaffControllerAdmin  (super-admin only)
// -----------------------------------------------------------------------------
export const Staff = {
  getAll: (params) => client.get('/admin/staff/all', { params }),
  create: (data) => client.post('/admin/staff/create', data),
  update: (staffID, data) =>
    client.put('/admin/staff/update', data, { params: { staffID } }),
  enable: (staffID) =>
    client.put('/admin/staff/enable', null, { params: { staffID } }),
  disable: (staffID) =>
    client.put('/admin/staff/disable', null, { params: { staffID } }),
};

// -----------------------------------------------------------------------------
// /admin/dealerships/  →  DealershipControllerAdmin
// Reads are open to all staff roles; mutations are super-admin only.
// -----------------------------------------------------------------------------
export const Dealerships = {
  getAll: () => client.get('/admin/dealerships/all'),
  create: (data) => client.post('/admin/dealerships/create', data),
  update: (dealershipID, data) =>
    client.put('/admin/dealerships/update', data, { params: { dealershipID } }),
  enable: (dealershipID) =>
    client.put('/admin/dealerships/enable', null, { params: { dealershipID } }),
  disable: (dealershipID) =>
    client.put('/admin/dealerships/disable', null, { params: { dealershipID } }),
  delete: (dealershipID) =>
    client.delete('/admin/dealerships/delete', { params: { dealershipID } }),
};

// -----------------------------------------------------------------------------
// /admin/extLeads/  →  ManageExternalLeadsController
// -----------------------------------------------------------------------------
export const ExternalLeads = {
  getAll: (params) => client.get('/admin/extLeads/all-leads', { params }),
  update: (adminID, data) =>
    client.put('/admin/extLeads/update', data, { params: { adminID } }),
  delete: (adminID, data) =>
    client.put('/admin/extLeads/delete', data, { params: { adminID } }),
  removeFromDB: (adminID, leadID) =>
    client.get('/admin/extLeads/remove-db', { params: { adminID, leadID } }),
  close: (adminID, data) =>
    client.put('/admin/extLeads/close', data, { params: { adminID } }),
  alive: (adminID, leadID) =>
    client.put('/admin/extLeads/alive', null, { params: { adminID, leadID } }),
};

// -----------------------------------------------------------------------------
// /admin/sales/  →  SalesController
// `add` is the create endpoint (backend method is markSold). There is no
// separate /perform endpoint — the earlier stub referenced one that doesn't
// exist on the backend.
// -----------------------------------------------------------------------------
export const Sales = {
  getAll: (params) => client.get('/admin/sales/get-all-sales', { params }),
  add: (data) => client.post('/admin/sales/add-sale', data),
  update: (adminID, saleID, data) =>
    client.put('/admin/sales/update', data, { params: { adminID, saleID } }),
};

// -----------------------------------------------------------------------------
// /admin/finance/  →  FinanceController
// -----------------------------------------------------------------------------
export const Finance = {
  getAll: (params) => client.get('/admin/finance/', { params }),
  add: (financeName) =>
    client.post('/admin/finance/add', null, { params: { finance: financeName } }),
  enable: (financeID) =>
    client.put('/admin/finance/enable', null, { params: { financeID } }),
  disable: (financeID) =>
    client.put('/admin/finance/disable', null, { params: { financeID } }),
  addImage: (financeID, formData) =>
    client.put('/admin/finance/add-image', formData, {
      params: { financeID },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  countSummary: () => client.get('/admin/finance/finance-count-summary'),
};

// -----------------------------------------------------------------------------
// /admin/loan/  →  LoanControllerAdmin
// Loan leads — detailed-form applications and pre-qualification submissions.
// -----------------------------------------------------------------------------
export const Loans = {
  getAll: (params) => client.get('/admin/loan/', { params }),
  updateStatus: (loanID, status) =>
    client.put('/admin/loan/status', null, { params: { loanID, status } }),
};

// -----------------------------------------------------------------------------
// /admin/partners/  →  PartnerControllerAdmin
// `create` is the OTP-sending step (returns a clientID); `verify` finalizes
// the partner record. Backend has no separate /send-otp endpoint.
// -----------------------------------------------------------------------------
export const Partners = {
  getAll: (params) => client.get('/admin/partners/all', { params }),
  countSummary: () => client.get('/admin/partners/partners-count-summary'),
  paymentDetails: (adminID, partnerID) =>
    client.get('/admin/partners/payment-details', {
      params: { adminID, partnerID },
    }),
  create: (adminID, data) =>
    client.post('/admin/partners/create-partner', data, { params: { adminID } }),
  verify: (data) => client.post('/admin/partners/verify-partner', data),
  ban: (data) => client.post('/admin/partners/ban', data),
  unban: (data) => client.post('/admin/partners/unban', data),
  // NOTE: backend takes the new password as a query string parameter.
  // That's a security smell (passwords leak into access logs / browser history)
  // — track separately for a backend fix; proxying as-is for now.
  resetPassword: (params) =>
    client.put('/admin/partners/reset-partner-password', null, { params }),
};

// -----------------------------------------------------------------------------
// /admin/manage/  →  AdminRightsController
// -----------------------------------------------------------------------------
export const Users = {
  getAll: (params) => client.get('/admin/manage/all-users', { params }),
  getAllUserId: () => client.get('/admin/manage/getAllUserId'),
};

// -----------------------------------------------------------------------------
// /admin/review/  →  ReviewController
// -----------------------------------------------------------------------------
export const Reviews = {
  getAll: (params) => client.get('/admin/review/', { params }),
  hide: (reviewID) =>
    client.put('/admin/review/hide', null, { params: { reviewID } }),
  unhide: (reviewID) =>
    client.put('/admin/review/unhide', null, { params: { reviewID } }),
  delete: (reviewID) =>
    client.delete('/admin/review/', { params: { reviewID } }),
};

// -----------------------------------------------------------------------------
// /admin/firebase/notifications/  →  NotificationController
// -----------------------------------------------------------------------------
export const Notifications = {
  sendByTopic: (data) =>
    client.post('/admin/firebase/notifications/topic', data),
  sendByToken: (data) =>
    client.post('/admin/firebase/notifications/send-using-fcmToken', data),
};

// -----------------------------------------------------------------------------
// /admin/home-banner/  →  HomeBannerControllerAdmin
// Promotional carousel banners shown on the mobile home screen. Supports
// surface targeting (BIKES/CARS/BOTH), schedule windows, CTA deep links,
// city audience, and click/impression analytics.
// -----------------------------------------------------------------------------
export const HomeBanners = {
  getAll: (params) => client.get('/admin/home-banner/all', { params }),
  byId: (bannerID) =>
    client.get('/admin/home-banner/by-id', { params: { bannerID } }),
  create: (data) => client.post('/admin/home-banner/create', data),
  update: (bannerID, data) =>
    client.put('/admin/home-banner/update', data, { params: { bannerID } }),
  delete: (bannerID) =>
    client.delete('/admin/home-banner/delete', { params: { bannerID } }),
  enable: (bannerID) =>
    client.put('/admin/home-banner/enable', null, { params: { bannerID } }),
  disable: (bannerID) =>
    client.put('/admin/home-banner/disable', null, { params: { bannerID } }),
  reorder: (items) => client.put('/admin/home-banner/reorder', items),
  addImage: (bannerID, formData) =>
    client.post('/admin/home-banner/add-image', formData, {
      params: { bannerID },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeImage: (bannerID) =>
    client.delete('/admin/home-banner/remove-image', { params: { bannerID } }),
  analytics: (bannerID, params) =>
    client.get('/admin/home-banner/analytics', {
      params: { bannerID, ...params },
    }),
};

// -----------------------------------------------------------------------------
// /admin/offers/  →  OfferControllerAdmin
// -----------------------------------------------------------------------------
export const Offers = {
  getAll: (params) => client.get('/admin/offers/all', { params }),
  byId: (offerID) =>
    client.get('/admin/offers/by-id', { params: { offerID } }),
  create: (data) => client.post('/admin/offers/create', data),
  update: (offerID, data) =>
    client.put('/admin/offers/update', data, { params: { offerID } }),
  delete: (offerID) =>
    client.delete('/admin/offers/delete', { params: { offerID } }),
  enable: (offerID) =>
    client.put('/admin/offers/enable', null, { params: { offerID } }),
  disable: (offerID) =>
    client.put('/admin/offers/disable', null, { params: { offerID } }),
  addImage: (offerID, formData) =>
    client.post('/admin/offers/add-image', formData, {
      params: { offerID },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeImage: (offerID) =>
    client.delete('/admin/offers/remove-image', { params: { offerID } }),
  // Public read reused by the admin Leads view: "which offers currently apply
  // to this vehicle" (includes brand-wide and app-wide offers).
  activeForVehicle: (vehicleId) =>
    client.get('/user/offers/active', { params: { vehicleId } }),
};

// -----------------------------------------------------------------------------
// /admin/app-config/  →  AppFeatureFlagController
// -----------------------------------------------------------------------------
export const FeatureFlags = {
  getAll: () => client.get('/admin/app-config/feature-flags'),
  enable: (key, adminID) =>
    client.put('/admin/app-config/feature-flags/enable', null, {
      params: { key, adminID },
    }),
  disable: (key, adminID) =>
    client.put('/admin/app-config/feature-flags/disable', null, {
      params: { key, adminID },
    }),
};

// -----------------------------------------------------------------------------
// /admin/contact-info/  →  ContactInfoControllerAdmin
// Singleton "Contact Us" record — public email/phone + social-media URLs shown
// in the mobile apps.
// -----------------------------------------------------------------------------
export const ContactInfo = {
  get: () => client.get('/admin/contact-info/'),
  update: (adminID, data) =>
    client.put('/admin/contact-info/update', data, { params: { adminID } }),
};
