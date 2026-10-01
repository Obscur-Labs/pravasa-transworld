import { Router } from 'express';
import { asyncRouter } from '../utils/asyncRouter';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import * as apps from '../controllers/user/applications.controller';
import * as notifs from '../controllers/user/notifications.controller';
import * as vault from '../controllers/user/documentVault.controller';
import * as payments from '../controllers/user/payments.controller';
import * as profile from '../controllers/user/profile.controller';
import * as promos from '../controllers/user/promoCodes.controller';
import * as drafts from '../controllers/user/drafts.controller';

const router = asyncRouter();
router.use(protect);

// Profile
router.get('/profile', profile.getProfile);
router.put('/profile', profile.updateProfile);
router.post('/profile/photo', upload.single('file'), profile.uploadProfilePhoto);

// Countries (active, for application form, no showOnWebsite filter)
router.get('/countries', apps.getActiveCountries as any);

// Dashboard
router.get('/dashboard', apps.getDashboard);

// Applications
router.get('/applications', apps.getApplications);
router.post('/applications', apps.createApplication);
router.get('/applications/:id', apps.getApplication);
router.post('/ocr/passport', upload.single('file'), apps.scanPassport);
router.post('/applications/:id/documents', upload.single('file'), apps.uploadDocument);
router.post('/applications/:id/documents/from-vault', apps.addDocumentFromVault);
router.put('/applications/:id/courier', apps.submitCourierDetails);
router.post('/applications/:id/payment/start', payments.startPayment);
// Optional screenshot of the payment rides along as a multipart file.
router.post('/applications/:id/payment/submit', upload.single('screenshot'), payments.submitPayment);
// Earlier UPI-only paths, kept so a site built before bank transfer keeps working.
router.post('/applications/:id/payment/upi', payments.startPayment);
router.post('/applications/:id/payment/upi/submit', payments.submitPayment);

// Saved apply-flow progress
router.get('/drafts', drafts.getDrafts);
router.get('/drafts/:id', drafts.getDraft);
router.post('/drafts', drafts.createDraft);
router.put('/drafts/:id', drafts.updateDraft);
router.delete('/drafts/:id', drafts.deleteDraft);

// Document Vault
router.get('/vault', vault.getVaultDocuments);
router.get('/vault/:id/url', vault.getVaultDocumentUrl);   // signed view URL
router.post('/vault', upload.single('file'), vault.uploadVaultDocument);
router.delete('/vault/:id', vault.deleteVaultDocument);

// Promo Codes
router.post('/promo/validate', promos.validatePromoCode);

// Payment History
router.get('/payments', payments.getUserPayments);
router.get('/payments/:id/receipt', payments.downloadReceipt);

// Notifications
router.get('/notifications', notifs.getNotifications);
router.put('/notifications/read-all', notifs.markAllRead);
router.put('/notifications/:id/read', notifs.markAsRead);
router.delete('/notifications/all', notifs.deleteAllNotifications);
router.delete('/notifications/:id', notifs.deleteNotification);

export default router;
