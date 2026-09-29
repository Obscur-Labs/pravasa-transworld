// Secrets have no fallbacks: a missing one must stop the server, never run with a guessable default.
const ALWAYS_REQUIRED = ['JWT_SECRET', 'MONGODB_URI', 'ENCRYPTION_KEY'];
// Without these, mail fails. Tolerated in development, where OTPs are logged instead.
const PRODUCTION_REQUIRED = ['BREVO_API_KEY', 'EMAIL_FROM_ADDRESS'];

export function assertEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const required = isProd ? [...ALWAYS_REQUIRED, ...PRODUCTION_REQUIRED] : ALWAYS_REQUIRED;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

  if (!isProd) {
    const optional = PRODUCTION_REQUIRED.filter((k) => !process.env[k]?.trim());
    if (optional.length) console.warn(`[STARTUP] Not set (required in production): ${optional.join(', ')}`);
  }
}

function read(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const jwtSecret = (): string => read('JWT_SECRET');
export const encryptionKey = (): string => read('ENCRYPTION_KEY');
