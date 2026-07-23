import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '@tecpap/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { actorFromRequest } from '../../common/context/actor';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, ResetPasswordDto, RequestPasswordResetDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email + password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, actorFromRequest(req));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate an access token using a refresh token' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, actorFromRequest(req));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  logout(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.logout(dto.refreshToken, actorFromRequest(req));
  }

  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change the current user password' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.authService.changePassword(user, dto, actorFromRequest(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request a password reset token' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    const token = await this.authService.generateResetTokenByEmail(dto.email);
    // In production the token would be emailed. For dev/initial setup it is
    // returned so the administrator can deliver it securely.
    return { message: 'If the account exists, a reset token has been issued.', ...(process.env.NODE_ENV !== 'production' && token ? { token } : {}) };
  }

  @Public()
  @Post('password-reset/reset')
  @ApiOperation({ summary: 'Consume a reset token and set a new password' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto.token, dto.newPassword, actorFromRequest(req));
  }
}
