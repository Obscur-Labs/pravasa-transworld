import { Router } from 'express';
import { asyncRouter } from '../utils/asyncRouter';
import { getPublicCountries, getPublicVisaTypes, getPublicCountryBySlug, downloadVisaSummaryPdf } from '../controllers/user/applications.controller';
import { submitContactLead } from '../controllers/admin/contactLeads.controller';
import { getWebsitePromos } from '../controllers/public/promoCodes.controller';
import { getPublicVisaConfig } from '../controllers/public/visaConfig.controller';
import { submitServiceInquiry } from '../controllers/public/serviceInquiries.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { inquiryLimiter } from '../middleware/rateLimiter';

const router = asyncRouter();

router.get('/countries', getPublicCountries as any);
router.get('/countries/:slug', optionalAuth as any, getPublicCountryBySlug as any);
router.get('/visa-types', optionalAuth as any, getPublicVisaTypes as any);
router.get('/visa-types/:id/pdf', downloadVisaSummaryPdf as any);
router.post('/contact', inquiryLimiter, submitContactLead);
router.post('/inquiries/:service', inquiryLimiter, submitServiceInquiry);
router.get('/promos', getWebsitePromos);
router.get('/visa-config', getPublicVisaConfig);

export default router;
