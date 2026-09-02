// Auth utilities - Edge Runtime compatible (Web Crypto API)
// Replaces Node.js crypto.scryptSync with PBKDF2 via Web Crypto API
// NOTE: hashPassword and verifyPassword are now ASYNC (return Promise)

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64; // 512 bits
const SALT_LEN = 16; // 128 bits

/**
 * Generate random bytes as hex string using Web Crypto API
 */
async function randomBytesHex(len: number): Promise<string> {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password using PBKDF2-SHA256 with random salt.
 * Output format: salt:hash (both in hex)
 * ASYNC because Web Crypto API is async.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await randomBytesHex(SALT_LEN);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEYLEN * 8
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against stored hash.
 * Supports:
 *   - New: salt:hash (PBKDF2 with random salt) - Cloudflare compatible
 *   - Legacy: salt:hash (scrypt with random salt) - local only, will fail on CF
 *   - Legacy: hash plano de 64 hex chars (SHA-256 viejo) - migration
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Format nuevo: salt:hash (PBKDF2)
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      PBKDF2_KEYLEN * 8
    );
    const verify = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return verify === hash;
  }

  // Formato legacy: hash SHA-256 plano (64 hex chars)
  if (storedHash.length === 64 && /^[a-f0-9]{64}$/i.test(storedHash)) {
    const SALT = 'myecommerce-pos-v2.5';
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const oldHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return oldHash === storedHash;
  }

  return false;
}

/**
 * Indicates if a hash needs rehashing to the new PBKDF2 format.
 */
export function needsRehash(storedHash: string): boolean {
  return !storedHash.includes(':');
}
