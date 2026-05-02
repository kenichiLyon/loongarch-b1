import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { UserRole } from '../domain/core';
import { hashPassword, verifyPassword } from '../security/password';
import type { BootstrapAdminDto, LoginDto } from './auth.dto';
import { readTokenSecret, readTokenTtlSeconds, safeEqual, signAuthToken, verifyAuthToken } from './auth.token';
import type { AuthenticatedUser, AuthTokenPayload } from './auth.types';

interface UserRow extends QueryResultRow {
  id: string;
  role: UserRole;
  username: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async login(dto: LoginDto) {
    const result = await this.database.query<UserRow>(
      `SELECT id, role, username, display_name AS "displayName", password_hash AS "passwordHash", is_active AS "isActive"
         FROM users
        WHERE username = $1`,
      [dto.username],
    );

    const user = result.rows[0];
    if (!user || !user.isActive || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.issueToken(toAuthenticatedUser(user));
  }

  async bootstrapAdmin(dto: BootstrapAdminDto) {
    const expectedToken = process.env.AUTH_BOOTSTRAP_TOKEN;
    if (!expectedToken || !safeEqual(dto.bootstrapToken, expectedToken)) {
      throw new UnauthorizedException('Invalid bootstrap token');
    }

    const countResult = await this.database.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    if (Number(countResult.rows[0]?.count ?? 0) > 0) {
      throw new ConflictException('Bootstrap is only allowed before the first user is created');
    }

    const userResult = await this.database.query<UserRow>(
      `INSERT INTO users (role, username, display_name, password_hash, email, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, role, username, display_name AS "displayName", password_hash AS "passwordHash", is_active AS "isActive"`,
      [UserRole.Admin, dto.username, dto.displayName, hashPassword(dto.initialPassword), dto.email ?? null],
    );

    return this.issueToken(toAuthenticatedUser(userResult.rows[0]));
  }

  verifyBearerToken(token: string) {
    const payload = verifyAuthToken(token, readTokenSecret());
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired bearer token');
    }
    return toAuthenticatedUser(payload);
  }

  private issueToken(user: AuthenticatedUser) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = readTokenTtlSeconds();
    const payload: AuthTokenPayload = {
      sub: user.id,
      role: user.role,
      username: user.username,
      displayName: user.displayName,
      iat: now,
      exp: now + expiresIn,
    };

    return {
      tokenType: 'Bearer',
      accessToken: signAuthToken(payload, readTokenSecret()),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      user,
    };
  }
}

function toAuthenticatedUser(row: Pick<UserRow, 'id' | 'role' | 'username' | 'displayName'> | AuthTokenPayload): AuthenticatedUser {
  return {
    id: 'sub' in row ? row.sub : row.id,
    role: row.role,
    username: row.username,
    displayName: row.displayName,
  };
}
