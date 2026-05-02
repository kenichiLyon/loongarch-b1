import { createHmac, timingSafeEqual } from 'node:crypto';
import { UserRole } from '../domain/core';
import type { AuthTokenPayload } from './auth.types';

const header = { alg: 'HS256', typ: 'JWT' };

export function signAuthToken(payload: AuthTokenPayload, secret: string) {
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyAuthToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac('sha256', secret).update(signingInput).digest('base64url');

  if (!safeEqual(signature, expected)) {
    return null;
  }

  const payload = parsePayload(encodedPayload);
  if (!payload || payload.exp <= nowSeconds) {
    return null;
  }

  return payload;
}

export function readTokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_TOKEN_SECRET must be configured with at least 16 characters');
  }
  return secret;
}

export function readTokenTtlSeconds() {
  const ttl = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 8 * 60 * 60);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error('AUTH_TOKEN_TTL_SECONDS must be a positive number');
  }
  return Math.floor(ttl);
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function parsePayload(encodedPayload: string): AuthTokenPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AuthTokenPayload>;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.displayName !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      !Object.values(UserRole).includes(payload.role as UserRole)
    ) {
      return null;
    }
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}
