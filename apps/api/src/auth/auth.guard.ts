import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = this.authService.verifyBearerToken(token);
    return true;
  }
}

function extractBearerToken(value: string | string[] | undefined) {
  const authorization = Array.isArray(value) ? value[0] : value;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
