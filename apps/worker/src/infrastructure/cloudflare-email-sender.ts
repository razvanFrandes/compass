import type { EmailSender, OutgoingEmail } from '../application/workflows/email.ts';

/** The only sender the `EMAIL` binding allows (wrangler.jsonc `allowed_sender_addresses`). */
export const SENDER = { email: 'alerts@compass.razvanfrandes.com', name: 'Compass' } as const;

/** Sends through Cloudflare Email Sending (the Worker's `send_email` binding). */
export class CloudflareEmailSender implements EmailSender {
  readonly #binding: SendEmail;

  constructor(binding: SendEmail) {
    this.#binding = binding;
  }

  async send(email: OutgoingEmail): Promise<{ messageId: string } | { error: string }> {
    try {
      const { messageId } = await this.#binding.send({ from: SENDER, to: email.to, subject: email.subject, text: email.text, html: email.html });
      return { messageId };
    } catch (error) {
      // The cause (an E_* code and a message that may hold the address) is for the logs only.
      console.error('email send failed', (error as { code?: unknown } | null)?.code, error);
      return { error: 'The email could not be sent.' };
    }
  }
}
