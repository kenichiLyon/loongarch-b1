import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../domain/core';

export const ROLES_KEY = 'loongarch-b1:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
