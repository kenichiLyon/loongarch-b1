import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from '../domain/core';
import type { AuthRequest } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Missing authenticated user context');
    }

    if (!roles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient role privileges');
    }

    return true;
  }
}
