import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { BootstrapAdminDto, LoginDto } from './auth.dto';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('bootstrap-admin')
  bootstrapAdmin(@Body() dto: BootstrapAdminDto) {
    return this.authService.bootstrapAdmin(dto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
