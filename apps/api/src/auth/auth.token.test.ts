import assert from 'node:assert/strict';
import test from 'node:test';
import { UserRole } from '../domain/core';
import { signAuthToken, verifyAuthToken } from './auth.token';
import type { AuthTokenPayload } from './auth.types';

const payload: AuthTokenPayload = {
  sub: '00000000-0000-0000-0000-000000000001',
  role: UserRole.Admin,
  username: 'admin',
  displayName: '管理员',
  iat: 100,
  exp: 200,
};

test('signs and verifies auth tokens', () => {
  const token = signAuthToken(payload, 'test-secret-123456');

  assert.deepEqual(verifyAuthToken(token, 'test-secret-123456', 150), payload);
});

test('rejects expired or tampered auth tokens', () => {
  const token = signAuthToken(payload, 'test-secret-123456');

  assert.equal(verifyAuthToken(token, 'test-secret-123456', 250), null);
  assert.equal(verifyAuthToken(`${token.slice(0, -1)}x`, 'test-secret-123456', 150), null);
});
