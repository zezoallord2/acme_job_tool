import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { env, mailDriver } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { dataRoot } from "@/lib/storage";
import { logInfo, logWarn } from "@/lib/logger";

/**
 * Transactional email.
 *
 * Two drivers behind one interface:
 *
 *   - development: writes the rendered message to data/logs/mail.log. No
 *     credentials, no cost, and the only driver permitted to surface a password
 *     reset link for local testing.
 *   - smtp:        standard SMTP. Works with any compatible provider, so no
 *     vendor is named, imported or hardcoded here.
 *
 * `nodemailer` is used because it already implements the SMTP details correctly
 * (STARTTLS negotiation, implicit TLS, AUTH PLAIN/LOGIN, dot-stuffing, MIME)
 * and is vendor-neutral. Hand-rolling that would have been more code and less
 * trustworthy.
 *
 * Outbound only. There is no marketing send path in this module.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Always supplied so a plain-text client still receives a usable message. */
  text: string;
}

export interface SendResult {
  accepted: boolean;
  driver: "development" | "smtp";
  messageId?: string;
  /** Where the message landed in development, so a test or operator can read it. */
  location?: string;
}

export interface MailProvider {
  readonly name: "development" | "smtp";
  /** False when selected but not configured. Production must never rely on this. */
  isReady(): boolean;
  send(message: MailMessage): Promise<SendResult>;
}

// ---------------------------------------------------------------------------
// Development driver
// ---------------------------------------------------------------------------

/**
 * Writes messages to a local log file.
 *
 * Not a stub: the rendered message is the same one SMTP would carry, so links
 * and layout can be verified without an account and without spending anything.
 */
export class DevelopmentMailProvider implements MailProvider {
  readonly name = "development" as const;
  readonly location: string;

  constructor(location?: string) {
    this.location = location ?? join(dataRoot(), "logs", "mail.log");
  }

  isReady(): boolean {
    return true;
  }

  async send(message: MailMessage): Promise<SendResult> {
    await mkdir(join(this.location, ".."), { recursive: true });
    const entry = [
      "",
      "=".repeat(72),
      `[${new Date().toISOString()}]`,
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      `Driver:  development (written locally, not delivered)`,
      "-".repeat(72),
      message.text,
      "=".repeat(72),
    ].join("\n");
    await appendFile(this.location, entry, "utf8");

    logInfo(
      { operation: "mail.development" },
      "Message written to the development mail log",
      { to: message.to },
    );
    return { accepted: true, driver: this.name, location: this.location };
  }

  /** Test helper: every message captured so far. */
  async readAll(): Promise<string> {
    return readFile(this.location, "utf8").catch(() => "");
  }
}

// ---------------------------------------------------------------------------
// SMTP driver
// ---------------------------------------------------------------------------

export class SMTPMailProvider implements MailProvider {
  readonly name = "smtp" as const;

  constructor(
    private readonly options: {
      host: string;
      port: number;
      user?: string;
      password?: string;
      /** Implicit TLS. Defaults to true on 465 and false elsewhere. */
      secure: boolean;
      /**
       * Require an encrypted channel even when STARTTLS is not implicit.
       *
       * Defaults to true. Transactional mail here carries password-reset
       * tokens, so an opportunistic upgrade is not good enough: without this a
       * relay that omits STARTTLS would receive the token in cleartext and the
       * send would still report success. Set false only for a relay you control
       * on a private network.
       */
      requireSTARTTLS?: boolean;
      from: string;
      fromName: string;
    },
  ) {}

  isReady(): boolean {
    return Boolean(this.options.host && this.options.from);
  }

  static fromEnv(): SMTPMailProvider {
    const e = env();
    if (!e.SMTP_HOST) {
      throw Errors.configuration("MAIL_DRIVER=smtp requires SMTP_HOST.");
    }
    const port = e.SMTP_PORT ?? (e.SMTP_SECURE === false ? 25 : 587);
    return new SMTPMailProvider({
      host: e.SMTP_HOST,
      port,
      user: e.SMTP_USER,
      password: e.SMTP_PASSWORD,
      secure: e.SMTP_SECURE ?? port === 465,
      requireSTARTTLS: e.SMTP_REQUIRE_STARTTLS,
      from: e.MAIL_FROM_ADDRESS,
      fromName: e.MAIL_FROM_NAME,
    });
  }

  async send(message: MailMessage): Promise<SendResult> {
    if (!this.isReady()) {
      throw Errors.configuration("SMTP is selected but not configured.");
    }

    // Imported lazily so the development driver never loads the mail library.
    const { createTransport } = await import("nodemailer");

    const transport = createTransport({
      host: this.options.host,
      port: this.options.port,
      // Implicit TLS when secure; otherwise STARTTLS is negotiated when offered.
      secure: this.options.secure,
      requireTLS:
        this.options.secure || this.options.requireSTARTTLS !== false
          ? true
          : undefined,
      auth:
        this.options.user && this.options.password
          ? { user: this.options.user, pass: this.options.password }
          : undefined,
      // Some providers advertise a certificate that is valid but not publicly
      // trusted. Verification stays on; the escape hatch is explicit.
      tls: { rejectUnauthorized: true },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
    });

    try {
      const info = await transport.sendMail({
        from: { name: this.options.fromName, address: this.options.from },
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        // Marks it as machine-generated so it is not treated as a reply to a
        // support thread.
        headers: { "Auto-Submitted": "auto-generated" },
      });

      logInfo(
        { operation: "mail.smtp" },
        "Message accepted by the SMTP server",
        { to: message.to },
      );
      return {
        accepted: true,
        driver: this.name,
        messageId: String(info.messageId ?? "").slice(0, 200) || undefined,
      };
    } catch (e) {
      // The underlying error can contain credentials in a URL-style auth string,
      // so only the message class and short text are surfaced.
      logWarn({ operation: "mail.smtp" }, "SMTP delivery failed", {
        to: message.to,
        reason: e instanceof Error ? e.name : "unknown",
      });
      throw Errors.external(
        "The mail server did not accept the message. It will be retried or reported by the caller.",
        { reason: e instanceof Error ? e.message.slice(0, 160) : "unknown" },
      );
    } finally {
      transport.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

let provider: MailProvider | null = null;

export function mailProvider(): MailProvider {
  if (provider) return provider;

  if (mailDriver() === "smtp") {
    provider = SMTPMailProvider.fromEnv();
    logInfo({ operation: "mail.init" }, "Using SMTP for transactional email");
    return provider;
  }
  provider = new DevelopmentMailProvider();
  return provider;
}

export function resetMailProvider(): void {
  provider = null;
}

/** Test helper: the newest message sent by the development driver. */
export async function lastDevelopmentMessage(): Promise<{
  to: string;
  subject: string;
  body: string;
} | null> {
  const log = await new DevelopmentMailProvider().readAll();
  const blocks = log.split("=".repeat(72));
  const last = blocks.filter((b) => b.includes("Subject:")).pop();
  if (!last) return null;
  const to = /To:\s*(.+)/.exec(last)?.[1]?.trim() ?? "";
  const subject = /Subject:\s*(.+)/.exec(last)?.[1]?.trim() ?? "";
  const body = last
    .split("-".repeat(72))
    .pop()
    ?.split("=".repeat(72))[0]
    ?.trim();
  return { to, subject, body: body ?? "" };
}
