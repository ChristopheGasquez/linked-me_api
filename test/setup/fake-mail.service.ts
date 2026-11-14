export type SentMail = {
  type: 'verification' | 'password-reset' | 'account-locked';
  to: string;
  name: string;
  token?: string;
  callbackUrl?: string;
};

/**
 * Replaces MailService in E2E tests: nothing is sent, every mail is
 * recorded so tests can read the tokens (verification, password reset).
 */
export class FakeMailService {
  readonly sent: SentMail[] = [];

  sendVerificationEmail(
    to: string,
    name: string,
    token: string,
    callbackUrl?: string,
  ): Promise<void> {
    this.sent.push({ type: 'verification', to, name, token, callbackUrl });
    return Promise.resolve();
  }

  sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    callbackUrl?: string,
  ): Promise<void> {
    this.sent.push({ type: 'password-reset', to, name, token, callbackUrl });
    return Promise.resolve();
  }

  sendAccountLockedEmail(to: string, name: string): Promise<void> {
    this.sent.push({ type: 'account-locked', to, name });
    return Promise.resolve();
  }

  /** Token of the most recent mail of this type sent to this address. */
  lastToken(to: string, type: SentMail['type']): string {
    const mail = this.sent.findLast((m) => m.to === to && m.type === type);
    if (!mail?.token) {
      throw new Error(`No "${type}" mail with token sent to ${to}`);
    }
    return mail.token;
  }

  clear(): void {
    this.sent.length = 0;
  }
}
