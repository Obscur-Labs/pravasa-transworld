import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const sendOTP = (data: { name: string; email: string; phone: string; accountType: 'individual' | 'corporate'; gstNumber?: string }) =>
  api.post('/auth/send-otp', data);
export const sendLoginOTP = (data: { email: string }) =>
  api.post('/auth/send-login-otp', data);
export const verifyOTP = (data: { email: string; otp: string }) =>
  api.post('/auth/verify-otp', data);

// Public
export const getPublicCountries = () => api.get('/public/countries');
export const getPublicCountryBySlug = (slug: string) => api.get(`/public/countries/${slug}`);
export const getPublicVisaTypes = (countryId?: string) =>
  api.get('/public/visa-types', { params: { country: countryId } });
export const downloadVisaSummaryPdf = (visaTypeId: string) =>
  api.get(`/public/visa-types/${visaTypeId}/pdf`, { responseType: 'blob' });
export const submitContactLead = (data: { name: string; email: string; phone?: string; message: string }) =>
  api.post('/public/contact', data);
export const getPublicVisaConfig = () => api.get('/public/visa-config');
export const submitServiceInquiry = (service: string, data: Record<string, unknown>) =>
  api.post(`/public/inquiries/${service}`, data);

// User, Countries (all active, for the apply form, ignores showOnWebsite)
export const getActiveCountries = () => api.get('/user/countries');

// User, Applications
export const getDashboard = () => api.get('/user/dashboard');
export const getApplications = () => api.get('/user/applications');
export const createApplication = (data: { visaTypeId: string; formResponses: Record<string, string>; adults?: number; children?: number; travelDate?: string; acceptedTerms?: string[] }) =>
  api.post('/user/applications', data);
export const getApplication = (id: string) => api.get(`/user/applications/${id}`);
export const uploadDocument = (id: string, formData: FormData) =>
  api.post(`/user/applications/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const addDocumentFromVault = (id: string, data: { vaultDocId: string; requirementName: string }) =>
  api.post(`/user/applications/${id}/documents/from-vault`, data);
// Live passport OCR (no persistence) used to pre-fill the editable review form.
export const scanPassport = (formData: FormData) =>
  api.post('/user/ocr/passport', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const startPayment = (id: string, promoCode?: string) =>
  api.post(`/user/applications/${id}/payment/start`, promoCode ? { promoCode } : {});
// Multipart so an optional screenshot can ride along with the reference.
export const submitPayment = (
  id: string,
  data: { paymentId: string; method: 'upi' | 'bank_transfer'; utr: string; acceptedTerms: string[]; screenshot?: File | null },
) => {
  const form = new FormData();
  form.append('paymentId', data.paymentId);
  form.append('method', data.method);
  form.append('utr', data.utr);
  form.append('acceptedTerms', JSON.stringify(data.acceptedTerms));
  if (data.screenshot) form.append('screenshot', data.screenshot);
  return api.post(`/user/applications/${id}/payment/submit`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const submitCourierDetails = (id: string, data: { trackingNumber: string; phone: string; expectedDate: string }) =>
  api.put(`/user/applications/${id}/courier`, data);

// User, Document Vault
export const getVaultDocuments = () => api.get('/user/vault');
export const getVaultDocumentUrl = (id: string) => api.get(`/user/vault/${id}/url`);
export const uploadVaultDocument = (formData: FormData) =>
  api.post('/user/vault', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteVaultDocument = (id: string) => api.delete(`/user/vault/${id}`);

// User, Payments
export const getUserPayments = () => api.get('/user/payments');
export const downloadReceipt = (id: string) =>
  api.get(`/user/payments/${id}/receipt`, { responseType: 'blob' });

// User, Profile
export const getUserProfile = () => api.get('/user/profile');
export const updateProfile = (data: { name?: string; phone?: string; gstNumber?: string }) =>
  api.put('/user/profile', data);
export const uploadProfilePhoto = (formData: FormData) =>
  api.post('/user/profile/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Promo Codes
export const validatePromoCode = (data: { code: string; orderAmount: number }) =>
  api.post('/user/promo/validate', data);
export const getWebsitePromos = () => api.get('/public/promos');

// Notifications
export const getNotifications = () => api.get('/user/notifications');
export const markNotificationRead = (id: string) => api.put(`/user/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put('/user/notifications/read-all');
export const deleteNotification = (id: string) => api.delete(`/user/notifications/${id}`);
export const deleteAllNotifications = () => api.delete('/user/notifications/all');
