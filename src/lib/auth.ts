import crypto from "crypto";

// Constantes para scrypt (recomendadas por OWASP)
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;   // N = 2^14
const SCRYPT_BLOCK = 8;      // r
const SCRYPT_PARALLEL = 1;   // p

/**
 * Hashea una contraseña usando scrypt con salt aleatorio.
 * Formato de salida: salt:hash (ambos en hex)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, {
      cost: SCRYPT_COST,
      blockSize: SCRYPT_BLOCK,
      parallelization: SCRYPT_PARALLEL,
    })
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifica una contraseña contra un hash almacenado.
 * Soporta dos formatos:
 *   - Nuevo: salt:hash (scrypt con salt aleatorio)
 *   - Legacy: hash plano de 64 hex chars (SHA-256 viejo) - para migracion automatica
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  // Formato nuevo: salt:hash
  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    const verify = crypto
      .scryptSync(password, salt, SCRYPT_KEYLEN, {
        cost: SCRYPT_COST,
        blockSize: SCRYPT_BLOCK,
        parallelization: SCRYPT_PARALLEL,
      })
      .toString("hex");
    return verify === hash;
  }

  // Formato legacy: hash SHA-256 plano (64 hex chars)
  // Verifica con el metodo viejo para permitir migracion gradual
  if (storedHash.length === 64 && /^[a-f0-9]{64}$/i.test(storedHash)) {
    const SALT = "myecommerce-pos-v2.5";
    const oldHash = crypto.createHash("sha256").update(password + SALT).digest("hex");
    return oldHash === storedHash;
  }

  return false;
}

/**
 * Indica si un hash necesita ser actualizado al nuevo formato scrypt.
 * Se usa despues de un login exitoso para migrar hashes viejos automaticamente.
 */
export function needsRehash(storedHash: string): boolean {
  return !storedHash.includes(":");
}