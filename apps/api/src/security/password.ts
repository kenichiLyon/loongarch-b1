import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const hashLength = 64;

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, hashLength).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, hash] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, hashLength);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}
