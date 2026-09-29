import fs from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { getEnv } from "../config/env";
import { chooseProviders } from "../config/readiness";

/**
 * Transactional email boundary. Resend in live mode; in demo mode emails are written
 * to .data/emails as .html files instead of being sent.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Provider-side de-duplication key so a retried send never emails twice. */
  idempotencyKey: string | null;
  tags: Record<string, string>;
}

export interface EmailProvider {
  readonly id: "resend" | "demo-file";
  send(email: OutgoingEmail): Promise<{ messageId: string }>;
}

export class EmailSendError extends Error {
  readonly retriable: boolean;
  constructor(message: string, retriable: boolean) {
    super(message);
    this.name = "EmailSendError";
    this.retriable = retriable;
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly id = "resend" as const;
  private readonly client: Resend;
  private readonly from: string;
  private readonly replyTo: string | undefined;

  constructor(apiKey: string, from: string, replyTo: string | undefined) {
    this.client = new Resend(apiKey);
    this.from = from;
    this.replyTo = replyTo;
  }

  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    const { data, error } = await this.client.emails.send(
      {
        from: this.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
        tags: Object.entries(email.tags).map(([name, value]) => ({ name, value })),
      },
      email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
    );
    if (error || !data) {
      const name = (error as { name?: string } | null)?.name ?? "unknown";
      const retriable = !["validation_error", "invalid_from_address", "missing_required_field", "invalid_access", "restricted_api_key"].includes(name);
      throw new EmailSendError(`Resend rejected the email (${name})`, retriable);
    }
    return { messageId: data.id };
  }
}

class FileEmailProvider implements EmailProvider {
  readonly id = "demo-file" as const;
  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    const dir = path.resolve(".data", "emails");
    await fs.mkdir(dir, { recursive: true });
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${email.tags.kind ?? "email"}`;
    const header = `<!-- DEMO EMAIL (not sent)\nTo: ${email.to}\nSubject: ${email.subject}\n-->\n`;
    await fs.writeFile(path.join(dir, `${id}.html`), header + email.html, "utf8");
    return { messageId: `demo-${id}` };
  }
}

let override: EmailProvider | null = null;
export function setEmailProviderForTests(provider: EmailProvider | null): void {
  override = provider;
}

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  const env = getEnv();
  if (chooseProviders(env).email === "demo-file") return new FileEmailProvider();
  if (!env.RESEND_API_KEY) throw new EmailSendError("RESEND_API_KEY is not set", false);
  return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM, env.EMAIL_REPLY_TO ?? env.SUPPORT_EMAIL);
}
