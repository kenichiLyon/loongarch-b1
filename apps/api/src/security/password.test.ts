import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from './password';

test('hashes and verifies passwords with scrypt', () => {
  const encoded = hashPassword('password-123', 'fixed-salt');

  assert.match(encoded, /^scrypt\$fixed-salt\$[a-f0-9]+$/);
  assert.equal(verifyPassword('password-123', encoded), true);
  assert.equal(verifyPassword('wrong-password', encoded), false);
});

test('rejects malformed password hashes', () => {
  assert.equal(verifyPassword('password-123', 'plain-text'), false);
});
