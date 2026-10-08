import { asyncRouter } from '../utils/asyncRouter';
import { adminProtect, requireModule, requireSuperAdmin } from '../middleware/adminAuth.middleware';
import { upload, uploadDownload } from '../middleware/upload.middleware';
import * as countries from '../controllers/admin/countries.controller';
import * as visaTypes from '../controllers/admin/visaTypes.controller';
import * as apps from '../controllers/admin/applications.controller';
import * as leads from '../controllers/admin/contactLeads.controller';
import * as inquiries from '../controllers/admin/serviceInquiries.controller';
import * as notifications from '../controllers/admin/notifications.controller';
import * as users from '../controllers/admin/users.controller';
import * as formPresets from '../controllers/admin/formPresets.controller';
import * as trash from '../controllers/admin/trash.controller';
import * as promoCodes from '../controllers/admin/promoCodes.controller';
import * as activityLogs from '../controllers/admin/activityLogs.controller';
import * as visaConfig from '../controllers/admin/visaConfig.controller';
import * as receiptConfig from '../controllers/admin/receiptConfig.controller';
import * as embassyMail from '../controllers/admin/embassyMail.controller';
import * as profile from '../controllers/admin/profile.controller';
import * as termPresets from '../controllers/admin/termPresets.controller';
import * as payments from '../controllers/admin/payments.controller';
import * as ai from '../controllers/admin/ai.controller';
import * as team from '../controllers/admin/team.controller';
import * as badges from '../controllers/admin/badges.controller';
import { aiLimiter } from '../middleware/rateLimiter';

// Every route needs a signed-in staff account. Module guards then apply by method:
// GET needs view access, anything else needs manage (see requireModule).
const router = asyncRouter();
router.use(adminProtect);

// Your own account, notifications and the AI writer are open to every staff member.
router.route('/profile').get(profile.getProfile).put(profile.updateProfile);
router.put('/profile/password', profile.changePassword);
router.get('/badges', badges.getBadges);

// Team & Roles: super admins only, never a grantable module.
router.use('/team', requireSuperAdmin);
router.route('/team/roles').get(team.getRoles).post(team.createRole);
router.route('/team/roles/:id').put(team.updateRole).delete(team.deleteRole);
router.route('/team/members').get(team.getMembers).post(team.createMember);
router.route('/team/members/:id').get(team.getMember).put(team.updateMember).delete(team.deleteMember);
router.get('/team/sign-ins', team.getSignIns);

// Dashboard
router.get('/dashboard', requireModule('dashboard'), apps.getDashboardStats);

// Countries & Visas
router.use(['/countries', '/visa-types'], requireModule('countries', { readableBy: ['applications'] }));
router.route('/countries').get(countries.getCountries).post(countries.createCountry);
router.route('/countries/:id').get(countries.getCountry).put(countries.updateCountry).delete(countries.deleteCountry);
router.patch('/countries/:id/toggle', countries.toggleCountryStatus);
router.patch('/countries/:id/toggle-website', countries.toggleWebsiteVisibility);
router.put('/countries/:id/web-content', countries.updateWebContent);
router.post('/countries/:id/images', upload.single('image'), countries.uploadCountryImage);
router.delete('/countries/:id/images', countries.removeCountryImage);

router.route('/visa-types').get(visaTypes.getVisaTypes).post(visaTypes.createVisaType);
// Must stay above '/visa-types/:id', otherwise 'reorder' is matched as an id.
router.put('/visa-types/reorder', visaTypes.reorderVisaTypes);
router.post('/visa-types/downloads', uploadDownload.single('file'), visaTypes.uploadVisaDownload);
router.route('/visa-types/:id').get(visaTypes.getVisaType).put(visaTypes.updateVisaType).delete(visaTypes.deleteVisaType);
router.patch('/visa-types/:id/toggle', visaTypes.toggleVisaTypeStatus);

// Presets and visa options are also read by the visa editor in Countries & Visas.
router.use('/form-presets', requireModule('formPresets', { readableBy: ['countries'] }));
router.route('/form-presets').get(formPresets.getFormPresets).post(formPresets.createFormPreset);
router.route('/form-presets/:id').put(formPresets.updateFormPreset).delete(formPresets.deleteFormPreset);

router.use('/term-presets', requireModule('termPresets', { readableBy: ['countries'] }));
router.route('/term-presets').get(termPresets.getTermPresets).post(termPresets.createTermPreset);
router.route('/term-presets/:id').put(termPresets.updateTermPreset).delete(termPresets.deleteTermPreset);

router.use('/visa-config', requireModule('visaConfig', { readableBy: ['countries', 'applications'] }));
router.route('/visa-config').get(visaConfig.getVisaConfigOptions).post(visaConfig.createVisaConfigOption);
router.route('/visa-config/:id').put(visaConfig.updateVisaConfigOption).delete(visaConfig.deleteVisaConfigOption);

router.use('/receipt-config', requireModule('receiptSettings'));
router.route('/receipt-config').get(receiptConfig.getReceiptConfig).put(receiptConfig.updateReceiptConfig);
router.get('/receipt-config/demo', receiptConfig.downloadDemoReceipt);

router.use('/embassy-mail-config', requireModule('embassyMailSettings'));
router.route('/embassy-mail-config').get(embassyMail.getEmbassyMailConfig).put(embassyMail.updateEmbassyMailConfig);

// Trash
router.use('/trash', requireModule('trash'));
router.get('/trash', trash.getTrash);
router.delete('/trash', trash.emptyTrash);
router.put('/trash/:id/restore', trash.restoreTrashItem);
router.delete('/trash/:id', trash.deleteTrashItem);

// Applications. Recording a cash/manual payment is a payments action, so it's checked first.
router.put('/applications/:id/manual-payment', requireModule('payments', { level: 'manage' }), apps.manualPaymentOverride);
router.use('/applications', requireModule('applications'));
router.get('/applications', apps.getApplications);
router.get('/applications/:id', apps.getApplication);
router.put('/applications/:id/status', apps.updateStatus);
router.put('/applications/:id/document-review', apps.reviewDocument);
router.put('/applications/:id/approve-documents', apps.approveAllDocuments);
router.post('/applications/:id/visa-file', upload.single('file'), apps.uploadVisaFile);
router.put('/applications/:id/courier', apps.requestCourier);
router.put('/applications/:id/courier/received', apps.markCourierReceived);
router.get('/applications/:id/embassy-mail', embassyMail.getEmbassyMailDraft);
router.post('/applications/:id/embassy-mail', embassyMail.sendApplicationEmbassyMail);
router.get('/applications/:id/documents/zip', apps.downloadApplicationDocumentsZip);
router.get('/applications/:id/receipt', apps.downloadApplicationReceipt);
router.delete('/applications/:id', apps.deleteApplication);

// AI content writer
router.post('/ai/generate', aiLimiter, ai.generateAiContent);

// Payments
router.use('/payments', requireModule('payments'));
router.get('/payments', apps.getAdminPayments);
router.get('/payments/pending', payments.getPendingPayments);
router.put('/payments/:id/approve', payments.approveUpiPayment);
router.put('/payments/:id/reject', payments.rejectUpiPayment);

router.use('/payment-config', requireModule('paymentSettings'));
router.route('/payment-config').get(payments.getPaymentConfig).put(payments.updatePaymentConfig);

// Customers
router.use('/users', requireModule('customers'));
router.get('/users', apps.getUsers);
router.post('/users', users.createUser);
router.put('/users/:userId', users.updateUser);
router.delete('/users/:userId', users.deleteUser);
router.get('/users/:userId/applications', apps.getUserApplications);
router.get('/users/:userId/vault', users.getUserVaultDocuments);
router.get('/users/:userId/vault/zip', users.downloadUserVaultZip);
router.patch('/users/:userId/promo-applicable', users.togglePromoApplicable);

// Promo Codes
router.use('/promo-codes', requireModule('promoCodes'));
router.route('/promo-codes').get(promoCodes.getPromoCodes).post(promoCodes.createPromoCode);
router.route('/promo-codes/:id').put(promoCodes.updatePromoCode).delete(promoCodes.deletePromoCode);
router.patch('/promo-codes/:id/toggle', promoCodes.togglePromoActive);
router.patch('/promo-codes/:id/toggle-website', promoCodes.togglePromoWebsite);
router.get('/promo-codes/:id/history', promoCodes.getPromoHistory);

// Inquiries: contact messages and service requests
router.use(['/leads', '/inquiries'], requireModule('inquiries'));
router.get('/leads', leads.getLeads);
router.patch('/leads/:id/read', leads.markLeadRead);
router.delete('/leads/:id', leads.deleteLead);
router.get('/inquiries', inquiries.getServiceInquiries);
router.patch('/inquiries/:id/read', inquiries.markServiceInquiryRead);
router.delete('/inquiries/:id', inquiries.deleteServiceInquiry);

// Activity Logs: read-only module; clearing the log is for super admins.
router.get('/activity-logs', requireModule('activityLogs'), activityLogs.getActivityLogs);
router.delete('/activity-logs', requireSuperAdmin, activityLogs.deleteAllActivityLogs);

// Notifications (filtered to the modules each member can see)
router.get('/notifications', notifications.getNotifications);
router.put('/notifications/read-all', notifications.markAllAsRead);
router.put('/notifications/:id/read', notifications.markAsRead);
router.delete('/notifications/all', notifications.deleteAllNotifications);
router.delete('/notifications/:id', notifications.deleteNotification);

export default router;
