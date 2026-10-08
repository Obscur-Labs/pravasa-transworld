import axios from 'axios';
import { toast } from '@/components/ui/use-toast';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== 'undefined') {
      // Signed out, disabled, or password reset elsewhere: back to the login screen.
      if (err.response?.status === 401 && !err.config?.url?.includes('/auth/admin/login')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin-auth-storage');
        window.location.href = '/login';
      }
      // Permission denials explain themselves, whichever page triggered them.
      if (err.response?.status === 403) {
        toast({ title: 'Not allowed', description: err.response.data?.message || 'You do not have permission for this.', variant: 'destructive' });
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const adminLogin = (data: { username: string; password: string }) =>
  api.post('/auth/admin/login', data);

// Profile
export const getAdminProfile = () => api.get('/admin/profile');
export const updateAdminProfile = (data: { name: string; phone: string; email: string }) => api.put('/admin/profile', data);
export const changeOwnPassword = (data: { currentPassword: string; newPassword: string }) => api.put('/admin/profile/password', data);

// Team & Roles (super admin only)
export const getTeamRoles = () => api.get('/admin/team/roles');
export const createTeamRole = (data: Record<string, unknown>) => api.post('/admin/team/roles', data);
export const updateTeamRole = (id: string, data: Record<string, unknown>) => api.put(`/admin/team/roles/${id}`, data);
export const deleteTeamRole = (id: string) => api.delete(`/admin/team/roles/${id}`);
export const getTeamMembers = () => api.get('/admin/team/members');
export const getTeamMember = (id: string) => api.get(`/admin/team/members/${id}`);
export const createTeamMember = (data: Record<string, unknown>) => api.post('/admin/team/members', data);
export const updateTeamMember = (id: string, data: Record<string, unknown>) => api.put(`/admin/team/members/${id}`, data);
export const deleteTeamMember = (id: string) => api.delete(`/admin/team/members/${id}`);
export const getTeamSignIns = (params: { admin?: string; result?: string; days?: number }) => api.get('/admin/team/sign-ins', { params });

// Sidebar unread counts (only for modules this member can see)
export const getBadges = () => api.get('/admin/badges');

// Dashboard
export const getDashboardStats = () => api.get('/admin/dashboard');

// Countries
export const getCountries = () => api.get('/admin/countries');
export const getCountry = (id: string) => api.get(`/admin/countries/${id}`);
export const createCountry = (data: object) => api.post('/admin/countries', data);
export const updateCountry = (id: string, data: object) => api.put(`/admin/countries/${id}`, data);
export const deleteCountry = (id: string) => api.delete(`/admin/countries/${id}`);
export const toggleCountry = (id: string) => api.patch(`/admin/countries/${id}/toggle`);
export const toggleCountryWebsite = (id: string) => api.patch(`/admin/countries/${id}/toggle-website`);
export const updateCountryWebContent = (id: string, data: object) => api.put(`/admin/countries/${id}/web-content`, data);
export const uploadCountryImage = (id: string, formData: FormData) =>
  api.post(`/admin/countries/${id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const removeCountryImage = (id: string, imageUrl: string) =>
  api.delete(`/admin/countries/${id}/images`, { data: { imageUrl } });

// Visa Types
export const getVisaTypes = (countryId?: string) =>
  api.get('/admin/visa-types', { params: { country: countryId } });
export const getVisaType = (id: string) => api.get(`/admin/visa-types/${id}`);
export const createVisaType = (data: object) => api.post('/admin/visa-types', data);
export const updateVisaType = (id: string, data: object) => api.put(`/admin/visa-types/${id}`, data);
export const deleteVisaType = (id: string) => api.delete(`/admin/visa-types/${id}`);
export const toggleVisaType = (id: string) => api.patch(`/admin/visa-types/${id}/toggle`);
/** `ids` is one country's visa types in display order; index becomes their `order`. */
export const reorderVisaTypes = (ids: string[]) => api.put('/admin/visa-types/reorder', { ids });
export const uploadVisaDownload = (formData: FormData) =>
  api.post('/admin/visa-types/downloads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Form Presets
export const getFormPresets = () => api.get('/admin/form-presets');
export const createFormPreset = (data: object) => api.post('/admin/form-presets', data);
export const updateFormPreset = (id: string, data: object) => api.put(`/admin/form-presets/${id}`, data);
export const deleteFormPreset = (id: string) => api.delete(`/admin/form-presets/${id}`);

// Terms Presets
export const getTermPresets = () => api.get('/admin/term-presets');
export const createTermPreset = (data: object) => api.post('/admin/term-presets', data);
export const updateTermPreset = (id: string, data: object) => api.put(`/admin/term-presets/${id}`, data);
export const deleteTermPreset = (id: string) => api.delete(`/admin/term-presets/${id}`);

// Visa Config
export const getVisaConfig = () => api.get('/admin/visa-config');
export const createVisaConfigOption = (data: object) => api.post('/admin/visa-config', data);
export const updateVisaConfigOption = (id: string, data: object) => api.put(`/admin/visa-config/${id}`, data);
export const deleteVisaConfigOption = (id: string) => api.delete(`/admin/visa-config/${id}`);

// Receipt Config
export const getReceiptConfig = () => api.get('/admin/receipt-config');
export const updateReceiptConfig = (data: object) => api.put('/admin/receipt-config', data);
export const downloadDemoReceipt = () => api.get('/admin/receipt-config/demo', { responseType: 'blob' });

// Embassy Mail
export const getEmbassyMailConfig = () => api.get('/admin/embassy-mail-config');
export const updateEmbassyMailConfig = (data: object) => api.put('/admin/embassy-mail-config', data);
/** The saved format filled in with one application's data, plus its attachable docs and send history. */
export const getEmbassyMailDraft = (id: string) => api.get(`/admin/applications/${id}/embassy-mail`);
export const sendEmbassyMail = (
  id: string,
  data: { to: string; cc?: string; subject: string; body: string; documentIds: string[] },
) => api.post(`/admin/applications/${id}/embassy-mail`, data);

// Activity Logs
export const getActivityLogs = (params: { admin?: string; module?: string; action?: string } = {}) => api.get('/admin/activity-logs', { params });
export const deleteAllActivityLogs = () => api.delete('/admin/activity-logs');

// Trash
export const getTrash = () => api.get('/admin/trash');
export const restoreTrashItem = (id: string) => api.put(`/admin/trash/${id}/restore`);
export const deleteTrashItem = (id: string) => api.delete(`/admin/trash/${id}`);
export const emptyTrash = () => api.delete('/admin/trash');

// Applications
export const getApplications = (params?: object) => api.get('/admin/applications', { params });
export const getApplication = (id: string) => api.get(`/admin/applications/${id}`);
export const updateStatus = (id: string, data: object) => api.put(`/admin/applications/${id}/status`, data);
export const reviewDocument = (id: string, data: object) => api.put(`/admin/applications/${id}/document-review`, data);
export const approveAllDocuments = (id: string) => api.put(`/admin/applications/${id}/approve-documents`);
export const downloadApplicationDocumentsZip = (id: string) =>
  api.get(`/admin/applications/${id}/documents/zip`, { responseType: 'blob' });
export const downloadApplicationReceipt = (id: string) =>
  api.get(`/admin/applications/${id}/receipt`, { responseType: 'blob' });
export const uploadVisaFile = (id: string, formData: FormData) =>
  api.post(`/admin/applications/${id}/visa-file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const manualPaymentOverride = (id: string, adminNote?: string) =>
  api.put(`/admin/applications/${id}/manual-payment`, { adminNote });
export const requestCourier = (id: string, data: { requested: boolean; instructions?: string; address?: string }) =>
  api.put(`/admin/applications/${id}/courier`, data);
export const markCourierReceived = (id: string) =>
  api.put(`/admin/applications/${id}/courier/received`);
export const deleteApplication = (id: string) => api.delete(`/admin/applications/${id}`);

// AI content writer
export const generateAiContent = (data: { purpose: string; context: Record<string, unknown>; currentText?: string; countryId?: string }) =>
  api.post('/admin/ai/generate', data);

// Payments
export const getAdminPayments = () => api.get('/admin/payments');
export const getPendingPayments = () => api.get('/admin/payments/pending');
export const approvePayment = (id: string, note?: string) => api.put(`/admin/payments/${id}/approve`, { note });
export const rejectPayment = (id: string, reason: string) => api.put(`/admin/payments/${id}/reject`, { reason });
export const getPaymentConfig = () => api.get('/admin/payment-config');
export const updatePaymentConfig = (data: object) => api.put('/admin/payment-config', data);

// Users
export const getUsers = () => api.get('/admin/users');
export const createUser = (data: object) => api.post('/admin/users', data);
export const updateUser = (userId: string, data: object) => api.put(`/admin/users/${userId}`, data);
export const deleteUser = (userId: string) => api.delete(`/admin/users/${userId}`);
export const getUserApplications = (userId: string) => api.get(`/admin/users/${userId}/applications`);
export const getUserVaultDocuments = (userId: string) => api.get(`/admin/users/${userId}/vault`);
export const downloadUserVaultZip = (userId: string) =>
  api.get(`/admin/users/${userId}/vault/zip`, { responseType: 'blob' });
export const toggleUserPromoApplicable = (userId: string) =>
  api.patch(`/admin/users/${userId}/promo-applicable`);

// Promo Codes
export const getPromoCodes = () => api.get('/admin/promo-codes');
export const createPromoCode = (data: object) => api.post('/admin/promo-codes', data);
export const updatePromoCode = (id: string, data: object) => api.put(`/admin/promo-codes/${id}`, data);
export const deletePromoCode = (id: string) => api.delete(`/admin/promo-codes/${id}`);
export const togglePromoActive = (id: string) => api.patch(`/admin/promo-codes/${id}/toggle`);
export const togglePromoWebsite = (id: string) => api.patch(`/admin/promo-codes/${id}/toggle-website`);
export const getPromoHistory = (id: string) => api.get(`/admin/promo-codes/${id}/history`);

// Contact Leads
export const getLeads = () => api.get('/admin/leads');
export const markLeadRead = (id: string) => api.patch(`/admin/leads/${id}/read`);
export const deleteLead = (id: string) => api.delete(`/admin/leads/${id}`);
export const getServiceInquiries = () => api.get('/admin/inquiries');
export const markServiceInquiryRead = (id: string) => api.patch(`/admin/inquiries/${id}/read`);
export const deleteServiceInquiry = (id: string) => api.delete(`/admin/inquiries/${id}`);

// Notifications
export const getAdminNotifications = (before?: string) => api.get('/admin/notifications', { params: { before } });
export const markAdminNotificationRead = (id: string) => api.put(`/admin/notifications/${id}/read`);
export const markAllAdminNotificationsRead = () => api.put('/admin/notifications/read-all');
export const deleteAdminNotification = (id: string) => api.delete(`/admin/notifications/${id}`);
export const deleteAllAdminNotifications = () => api.delete('/admin/notifications/all');
