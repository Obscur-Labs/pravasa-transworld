import express from 'express';
import { asyncRouter } from '../utils/asyncRouter';
import { razorpayWebhook } from '../controllers/webhooks.controller';

const router = asyncRouter();

// Raw body: the signature is computed over the exact bytes Razorpay sent.
router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);

export default router;
