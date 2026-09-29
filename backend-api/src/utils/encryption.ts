import crypto from 'crypto';
import { encryptionKey } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard: 96-bit IV

const getSecretKey = (): Buffer => crypto.createHash('sha256').update(encryptionKey()).digest();

// Format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
export function encryptData(text: string): string {
  if (!text || text.startsWith('enc:')) return text;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptData(text: string): string {
  if (!text || !text.startsWith('enc:')) return text;

  try {
    // Slice off the "enc:" prefix then split into exactly 3 remaining parts
    const rest = text.slice(4);
    const firstColon = rest.indexOf(':');
    const secondColon = rest.indexOf(':', firstColon + 1);

    if (firstColon === -1 || secondColon === -1) return text;

    const ivHex = rest.slice(0, firstColon);
    const authTagHex = rest.slice(firstColon + 1, secondColon);
    const encryptedHex = rest.slice(secondColon + 1);

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = getSecretKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Keep the ciphertext. Returning '' here would let the next save() overwrite the real
    // value with an empty string. encryptData() leaves "enc:" values untouched, so the
    // stored data survives until the right ENCRYPTION_KEY is back.
    console.error('[ENCRYPTION] Could not decrypt a stored value. Is ENCRYPTION_KEY correct?');
    return text;
  }
}
