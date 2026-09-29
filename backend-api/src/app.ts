import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/user.routes';
import publicRoutes from './routes/public.routes';
import cronRoutes from './routes/cron.routes';
const app = express();
app.set('trust proxy', 1);

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://pravasatransworld.com',
  'https://www.pravasatransworld.com',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL] : []),
];

const isAllowedOrigin = (origin: string) =>
  allowedOrigins.includes(origin) || /^https:\/\/[\w-]+(\.vercel\.app)$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Request Logging (Morgan) ─────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── HTTP Security Headers (Helmet) ──────────────────────────────────────────
// Disabled contentSecurityPolicy for a JSON API — CSP is a browser/HTML concern.
app.use(helmet({ contentSecurityPolicy: false }));

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── NoSQL Injection Protection ────────────────────────────────────────────────
// Strips MongoDB operators ($gt, $where, etc.) from req.body, req.query, req.params.
app.use(mongoSanitize());

// ── XSS Sanitisation ─────────────────────────────────────────────────────────
// Recursively escapes HTML tags in every string value of req.body / req.query.
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query) as typeof req.query;
  next();
});

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Pravasa Transworld API' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'active' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/cron', cronRoutes);

// Developer panel: git-ignored and unauthenticated, so it needs an explicit opt-in and
// only answers requests from this machine. remoteAddress is the real socket peer, which
// X-Forwarded-For can't spoof.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_PANEL === 'true') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const devRoutes = require('./routes/dev.routes').default;
    app.use('/dev', (req, res, next) => {
      if (LOOPBACK.has(req.socket.remoteAddress || '')) return next();
      res.status(404).json({ success: false, message: 'Route not found' });
    }, devRoutes);
    console.log('[DEV] Developer panel active at /dev (localhost only)');
  } catch {
    // dev.routes.ts not present on this machine
  }
}

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Error Handler ────────────────────────────────────────────────────────────
// Must be last, and must keep all four parameters for Express to recognise it.
// Routes are built with asyncRouter(), so rejected promises land here instead of
// becoming unhandled rejections that kill the process.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  // Mongoose schema validation — surface the specific field(s) that failed.
  if (err?.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e: any) => e.message);
    return res.status(400).json({ success: false, message: errors[0] || 'Validation failed', errors });
  }

  // Malformed ObjectId in a path/query param.
  if (err?.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  }

  // Unique index violation.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ success: false, message: field ? `That ${field} is already in use` : 'Duplicate value' });
  }

  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'Origin not allowed' });
  }

  console.error('[ERROR]', err);
  return res.status(err?.status || err?.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err?.message || 'Something went wrong',
  });
});

export default app;
