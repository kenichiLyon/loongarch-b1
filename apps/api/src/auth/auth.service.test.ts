import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import { UserRole } from '../domain/core';
import { hashPassword } from '../security/password';
import { AuthService } from './auth.service';

const authEnv = {
  AUTH_TOKEN_SECRET: 'unit-test-secret-123456',
  AUTH_TOKEN_TTL_SECONDS: '60',
  AUTH_BOOTSTRAP_TOKEN: 'bootstrap-token-123',
};

test('logs in active users with a valid password', async () => {
  await withAuthEnv(async () => {
    const service = new AuthService(
      fakeDatabase(async () => ({
        rows: [
          {
            id: '00000000-0000-0000-0000-000000000001',
            role: UserRole.Admin,
            username: 'admin',
            displayName: 'Admin',
            passwordHash: hashPassword('password-123', 'fixed-salt'),
            isActive: true,
          },
        ],
      })),
    );

    const result = await service.login({ username: 'admin', password: 'password-123' });

    assert.equal(result.tokenType, 'Bearer');
    assert.equal(result.user.username, 'admin');
    assert.match(result.accessToken, /^[^.]+\.[^.]+\.[^.]+$/);
  });
});

test('rejects invalid login attempts', async () => {
  await withAuthEnv(async () => {
    const service = new AuthService(
      fakeDatabase(async () => ({
        rows: [
          {
            id: '00000000-0000-0000-0000-000000000001',
            role: UserRole.Admin,
            username: 'admin',
            displayName: 'Admin',
            passwordHash: hashPassword('password-123', 'fixed-salt'),
            isActive: true,
          },
        ],
      })),
    );

    await assert.rejects(() => service.login({ username: 'admin', password: 'wrong-password' }), UnauthorizedException);
  });
});

test('bootstraps the first admin when the token matches and no users exist', async () => {
  await withAuthEnv(async () => {
    const queries: string[] = [];
    const service = new AuthService(
      fakeDatabase(async (sql) => {
        queries.push(sql);
        if (sql.includes('COUNT(*)')) {
          return { rows: [{ count: '0' }] };
        }
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              role: UserRole.Admin,
              username: 'admin',
              displayName: 'Admin',
              passwordHash: hashPassword('password-123', 'fixed-salt'),
              isActive: true,
            },
          ],
        };
      }),
    );

    const result = await service.bootstrapAdmin({
      bootstrapToken: 'bootstrap-token-123',
      username: 'admin',
      displayName: 'Admin',
      initialPassword: 'password-123',
    });

    assert.equal(result.user.role, UserRole.Admin);
    assert.equal(queries.some((sql) => sql.includes('INSERT INTO users')), true);
  });
});

test('rejects bootstrap after users already exist', async () => {
  await withAuthEnv(async () => {
    const service = new AuthService(fakeDatabase(async () => ({ rows: [{ count: '1' }] })));

    await assert.rejects(
      () =>
        service.bootstrapAdmin({
          bootstrapToken: 'bootstrap-token-123',
          username: 'admin',
          displayName: 'Admin',
          initialPassword: 'password-123',
        }),
      ConflictException,
    );
  });
});

function fakeDatabase(query: (sql: string, params: readonly unknown[]) => Promise<{ rows: unknown[] }>) {
  return {
    query,
  } as unknown as DatabaseService;
}

async function withAuthEnv(run: () => Promise<void>) {
  const previous = {
    AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET,
    AUTH_TOKEN_TTL_SECONDS: process.env.AUTH_TOKEN_TTL_SECONDS,
    AUTH_BOOTSTRAP_TOKEN: process.env.AUTH_BOOTSTRAP_TOKEN,
  };

  Object.assign(process.env, authEnv);
  try {
    await run();
  } finally {
    restoreEnv(previous);
  }
}

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
