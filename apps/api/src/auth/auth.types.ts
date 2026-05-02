import { UserRole } from '../domain/core';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  username: string;
  displayName: string;
}

export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  username: string;
  displayName: string;
  iat: number;
  exp: number;
}
