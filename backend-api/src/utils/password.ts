import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export const PASSWORD_MIN_LENGTH = 8;

/** Format: scrypt$<salt hex>$<hash hex>. Node's built-in scrypt, no native dependency. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [scheme, saltHex, hashHex] = (stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > 128) return 'Password is too long';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password needs at least one letter and one number';
  return null;
}
