import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../common/dto/message-response.dto.js';

// ─── Email verified ────────────────────────────────────────────────────────────

export class EmailVerifiedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Email verified successfully' })
  declare message: string;

  @ApiProperty({ example: 'auth.email.verified' })
  declare code: string;
}

// ─── Verification email resent ─────────────────────────────────────────────────

export class VerificationEmailResentResponseDto extends MessageResponseDto {
  @ApiProperty({
    example:
      'If an unverified account with this email exists, a new link has been sent',
  })
  declare message: string;

  @ApiProperty({ example: 'auth.email.resend_sent' })
  declare code: string;
}

// ─── Forgot password ───────────────────────────────────────────────────────────

export class ForgotPasswordResponseDto extends MessageResponseDto {
  @ApiProperty({
    example: 'If an account with this email exists, a reset link has been sent',
  })
  declare message: string;

  @ApiProperty({ example: 'auth.forgot_password.sent' })
  declare code: string;
}

// ─── Password reset ────────────────────────────────────────────────────────────

export class PasswordResetResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Password reset successfully. Please log in again.' })
  declare message: string;

  @ApiProperty({ example: 'auth.password_reset.success' })
  declare code: string;
}

// ─── Refresh ───────────────────────────────────────────────────────────────────

export class RefreshResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Session refreshed' })
  declare message: string;

  @ApiProperty({ example: 'auth.refresh.success' })
  declare code: string;
}

// ─── Logout ────────────────────────────────────────────────────────────────────

export class LogoutResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Logged out successfully' })
  declare message: string;

  @ApiProperty({ example: 'auth.logout.success' })
  declare code: string;
}

// ─── Logout all ────────────────────────────────────────────────────────────────

export class LogoutAllResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'All sessions revoked' })
  declare message: string;

  @ApiProperty({ example: 'auth.logout_all.success' })
  declare code: string;
}

// ─── Session revoked ───────────────────────────────────────────────────────────

export class SessionRevokedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Session revoked' })
  declare message: string;

  @ApiProperty({ example: 'auth.session.revoked' })
  declare code: string;
}
