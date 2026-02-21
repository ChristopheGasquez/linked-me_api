import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;
  private fromEmail: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow('RESEND_API_KEY'));
    this.fromEmail = this.config.get('MAIL_FROM', 'onboarding@resend.dev');
  }

  async sendPasswordResetEmail(to: string, name: string, token: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', this.config.getOrThrow('APP_URL'));
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Réinitialisation de votre mot de passe - Linked Me',
      html: `
        <h1>Réinitialisation de mot de passe</h1>
        <p>Bonjour ${name},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <a href="${resetUrl}">Réinitialiser mon mot de passe</a>
        <p>Ou copiez ce token dans votre client API :</p>
        <pre>${token}</pre>
        <p>Ce lien expire dans 1 heure.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      `,
    });
  }

  async sendAccountLockedEmail(to: string, name: string) {
    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Votre compte a été temporairement verrouillé - Linked Me',
      html: `
        <h1>Compte verrouillé</h1>
        <p>Bonjour ${name},</p>
        <p>5 tentatives de connexion échouées ont été détectées sur votre compte.</p>
        <p>Votre compte est verrouillé pour <strong>15 minutes</strong>.</p>
        <p>Si vous n'êtes pas à l'origine de ces tentatives, nous vous recommandons de changer votre mot de passe dès que vous pouvez vous reconnecter.</p>
      `,
    });
  }

  async sendVerificationEmail(to: string, name: string, token: string) {
    const appUrl = this.config.getOrThrow('APP_URL');
    const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;

    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Vérifiez votre adresse email - Linked Me',
      html: `
        <h1>Bienvenue ${name} !</h1>
        <p>Cliquez sur le lien ci-dessous pour vérifier votre adresse email :</p>
        <a href="${verifyUrl}">Vérifier mon email</a>
        <p>Ce lien expire dans 24 heures.</p>
        <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
      `,
    });
  }
}
