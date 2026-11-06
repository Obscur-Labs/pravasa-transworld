import { asyncRouter } from '../utils/asyncRouter';
import { adminProtect, requireModule, requireSuperAdmin } from '../middleware/adminAuth.middleware';
import { upload, uploadDownload } from '../middleware/upload.middleware';
import * as countries from '../controllers/admin/countries.controller';
import * as visaTypes from '../controllers/admin/visaTypes.controller';
import * as apps from '../controllers/admin/applications.controller';
import * as processing from '../controllers/admin/processing.controller';
import * as twoFactor from '../controllers/admin/twoFactor.controller';
import * as reports from '../controllers/admin/reports.controller';
import * as notes from '../controllers/admin/notes.controller';
import * as leads from '../controllers/admin/contactLeads.controller';
import * as inquiries from '../controllers/admin/serviceInquiries.controller';
import * as agents from '../controllers/admin/agents.controller';
import { adminListTestimonials, adminUpdateTestimonial } from '../controllers/public/testimonials.controller';
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
router.post('/profile/2fa/setup', twoFactor.startTwoFactor);
router.post('/profile/2fa/enable', twoFactor.enableTwoFactor);
router.post('/profile/2fa/recovery-codes', twoFactor.regenerateRecoveryCodes);
router.post('/profile/2fa/disable', twoFactor.disableTwoFactor);
router.get('/badges', badges.getBadges);

// Team & Roles: super admins only, never a grantable module.
router.use('/team', requireSuperAdmin);
router.route('/team/roles').get(team.getRoles).post(team.createRole);
router.route('/team/roles/:id').put(team.updateRole).delete(team.deleteRole);
router.route('/team/members').get(team.getMembers).post(team.createMember);
router.route('/team/members/:id').get(team.getMember).put(team.updateMember).delete(team.deleteMember);
router.get('/team/sign-ins', team.getSignIns);
router.route('/team/settings').get(team.getTeamSettings).put(team.updateTeamSettings);
router.post('/team/invite', team.inviteMember);
router.post('/team/members/:id/resend-invite', team.resendInvite);
router.post('/team/members/:id/reset-2fa', team.resetMemberTwoFactor);
router.post('/team/members/:id/remind', team.remindMember);

// Dashboard
router.get('/dashboard', requireModule('dashboard'), apps.getDashboardStats);

// Reports
router.use('/reports', requireModule('reports'));
router.get('/reports/revenue', reports.getRevenueReport);
router.get('/reports/gst', reports.getGstRegister);
router.get('/reports/gst.csv', reports.downloadGstRegisterCsv);
router.get('/reports/agents', reports.getAgentReport);
router.get('/reports/sla', reports.getSlaReport);

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
router.get('/visa-types/b2b-agents', visaTypes.getB2bAgents);
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
router.put('/receipt-config/hours', receiptConfig.updateBusinessHours);
router.put('/receipt-config/branding', receiptConfig.updateBranding);
router.post('/receipt-config/logo', upload.single('file'), receiptConfig.uploadLogo);
router.get('/receipt-config/demo', receiptConfig.downloadDemoReceipt);

router.use('/embassy-mail-config', requireModule('embassyMailSettings'));
router.route('/embassy-mail-config').get(embassyMail.getEmbassyMailConfig).put(embassyMail.updateEmbassyMailConfig);

// Trash
router.use('/trash', requireModule('trash'));
router.get('/trash', trash.getTrash);
router.delete('/trash', requireSuperAdmin, trash.emptyTrash);
router.put('/trash/:id/restore', trash.restoreTrashItem);
router.delete('/trash/:id', requireSuperAdmin, trash.deleteTrashItem);

// Applications. Recording a cash/manual payment is a payments action, so it's checked first.
router.put('/applications/:id/manual-payment', requireModule('payments', { level: 'manage' }), apps.manualPaymentOverride);
router.use('/applications', requireModule('applications'));
router.get('/applications', apps.getApplications);
router.get('/applications/assignees', apps.getAssignees);
router.get('/applications/export.csv', apps.exportApplicationsCsv);
router.post('/applications/bulk/assign', apps.assignApplications);
router.post('/applications/bulk/status', apps.bulkUpdateStatus);
router.put('/applications/:id/assign', apps.assignApplications);
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
router.put('/applications/:id/vfs-appointment', upload.single('letter'), processing.updateVfsAppointment);
router.get('/applications/:id/carry-checklist', processing.downloadCarryChecklist);
router.put('/applications/:id/travellers/:key/submission', processing.updateSubmission);
router.post('/applications/:id/additional-docs', processing.requestAdditionalDocs);
router.put('/applications/:id/additional-docs/submitted', processing.markAdditionalDocsSubmitted);
router.put('/applications/:id/dispatch', processing.updateDispatch);
router.put('/applications/:id/parent-link', processing.updateParentLink);
router.put('/applications/:id/embassy-reference', processing.updateEmbassyReference);
router.route('/applications/:id/notes').get(notes.getNotes).post(notes.addNote);

// AI content writer
router.post('/ai/generate', aiLimiter, ai.generateAiContent);

// Payments
router.use('/payments', requireModule('payments'));
router.get('/payments', apps.getAdminPayments);
router.get('/payments/pending', payments.getPendingPayments);
router.put('/payments/:id/approve', payments.approveUpiPayment);
router.put('/payments/:id/reject', payments.rejectUpiPayment);
router.put('/payments/:id/mismatch', payments.flagPaymentMismatch);

router.use('/payment-config', requireModule('paymentSettings'));
router.route('/payment-config').get(payments.getPaymentConfig).put(payments.updatePaymentConfig);

// Customers
router.use('/users', requireModule('customers'));
router.get('/users', apps.getUsers);
router.get('/users/export.csv', apps.exportUsersCsv);
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
router.patch('/inquiry-status/:kind/:id', requireModule('inquiries'), inquiries.setInquiryStatus);
router.delete('/inquiries/:id', inquiries.deleteServiceInquiry);
router.use('/testimonials', requireModule('inquiries'));
router.get('/testimonials', adminListTestimonials);
router.patch('/testimonials/:id', adminUpdateTestimonial);
router.use('/agents', requireModule('customers'));
router.get('/agents', agents.getAgents);
router.post('/agents', agents.createAgent);
router.post('/agents/commission', agents.postCommission);
router.put('/agents/:id', agents.updateAgent);
router.get('/agents/:id/statement', agents.getStatement);
router.get('/agents/:id/statement.csv', agents.exportStatementCsv);
router.post('/agents/:id/statement/email', agents.emailStatement);
router.post('/agents/:id/payments', agents.recordAgentPayment);
router.get('/inquiries/reply-templates', inquiries.getReplyTemplates);
router.put('/inquiries/reply-templates', inquiries.saveReplyTemplates);
router.post('/inquiries/:kind(lead|inquiry)/:id/replies', inquiries.sendInquiryReply);
router.patch('/inquiries/:kind(lead|inquiry)/:id/assign', inquiries.assignInquiry);
router.post('/inquiries/:kind(lead|inquiry)/:id/convert', inquiries.convertInquiry);

// Activity Logs: read-only module; clearing the log is for super admins.
router.get('/activity-logs', requireModule('activityLogs'), activityLogs.getActivityLogs);
router.get('/activity-logs/export.csv', requireModule('activityLogs'), activityLogs.exportActivityLogsCsv);

// Notifications (filtered to the modules each member can see)
router.get('/notifications', notifications.getNotifications);
router.route('/notifications/preferences').get(notifications.getNotificationPreferences).put(notifications.updateNotificationPreferences);
router.put('/notifications/read-all', notifications.markAllAsRead);
router.put('/notifications/:id/read', notifications.markAsRead);
router.delete('/notifications/all', notifications.deleteAllNotifications);
router.delete('/notifications/:id', notifications.deleteNotification);

export default router;
