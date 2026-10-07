import { env } from "@/lib/env";

/**
 * Transactional email templates.
 *
 * Deliberately minimal: a password reset, a welcome, and an important account
 * notice. No marketing, no sequences, no preferences. These are the only
 * messages the product sends, and each one exists because a person needs to do
 * something specific.
 *
 * Every template is rendered as both HTML and plain text, because a plain-text
 * client still has to be able to complete the action.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Shared chrome. Inline styles only, because mail clients strip <style>. */
function layout(options: {
  heading: string;
  intro: string;
  body: string;
  cta?: { label: string; url: string };
  footnote?: string;
}): RenderedEmail["html"] {
  const button = options.cta
    ? `<tr><td style="padding:8px 0 24px">
         <a href="${escapeHtml(options.cta.url)}"
            style="display:inline-block;background:#0f3d2e;color:#ffffff;
                   padding:12px 22px;border-radius:8px;text-decoration:none;
                   font-weight:600;font-size:15px">${escapeHtml(options.cta.label)}</a>
       </td></tr>
       <tr><td style="padding:0 0 20px;font-size:13px;color:#5b6b63">
         If the button does not work, paste this link into your browser:<br>
         <a href="${escapeHtml(options.cta.url)}" style="color:#0f3d2e">${escapeHtml(options.cta.url)}</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(options.heading)}</title></head>
<body style="margin:0;padding:0;background:#f7f7f5;
             font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f7f7f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid #e2e5e1;
                    border-radius:12px;padding:32px">
        <tr><td style="padding-bottom:20px;font-size:13px;font-weight:700;
                       letter-spacing:.06em;text-transform:uppercase;color:#0f3d2e">
              Acme Jobs
            </td></tr>
        <tr><td style="padding-bottom:12px;font-size:22px;font-weight:700;
                       color:#12211b;line-height:1.3">
              ${escapeHtml(options.heading)}
            </td></tr>
        <tr><td style="padding-bottom:8px;font-size:15px;color:#3c4a44;line-height:1.6">
              ${options.intro}
            </td></tr>
        <tr><td style="padding:8px 0 20px;font-size:15px;color:#3c4a44;line-height:1.6">
              ${options.body}
            </td></tr>
        ${button}
        <tr><td style="padding-top:16px;border-top:1px solid #eef1ee;
                       font-size:12px;color:#7b8a82;line-height:1.6">
              ${options.footnote ?? defaultFootnote()}
            </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function defaultFootnote(): string {
  return `${env().APP_NAME} never asks you to invent a metric, an employer or a job title. If a message ever seems to ask you to, it did not come from us.`;
}

/**
 * Escapes for HTML text and double-quoted attribute values.
 *
 * Applied to every interpolated value, including URLs. A reset link contains
 * user-independent data today, but a template that cannot be made unsafe when
 * that changes is not a template worth keeping.
 */
export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseUrl(): string {
  return env().APP_URL.replace(/\/+$/, "");
}

export function passwordResetEmail(options: {
  name: string | null;
  resetUrl: string;
  expiresInMinutes: number;
}): RenderedEmail {
  const greeting = options.name ? `Hi ${options.name},` : "Hi,";
  return {
    subject: "Reset your Acme Jobs password",
    html: layout({
      heading: "Reset your password",
      intro: `${greeting} someone asked to reset the password on your Acme Jobs account.`,
      body:
        "This link works once and then stops working. If that was you, choose a new password below. " +
        "If it was not you, ignore this message and nothing will change.",
      cta: { label: "Choose a new password", url: options.resetUrl },
      footnote:
        `This link expires in ${options.expiresInMinutes} minutes. ` +
        `Acme Jobs will never email you a password, and no support agent will ask for one.`,
    }),
    text: [
      greeting,
      "",
      "Someone asked to reset the password on your Acme Jobs account.",
      "This link works once and then stops working.",
      "If that was not you, ignore this message and nothing will change.",
      "",
      `Choose a new password: ${options.resetUrl}`,
      "",
      `This link expires in ${options.expiresInMinutes} minutes.`,
      "Acme Jobs will never email you a password.",
    ].join("\n"),
  };
}

export function welcomeEmail(options: { name: string | null }): RenderedEmail {
  const greeting = options.name ? `Hi ${options.name},` : "Hi,";
  return {
    subject: "Welcome to Acme Jobs",
    html: layout({
      heading: "Welcome to Acme Jobs",
      intro: `${greeting} your account is ready.`,
      body:
        "Start with the Evidence Ledger. It holds what is factually true about your career, " +
        "and every other part of the product is only allowed to use that.",
      cta: {
        label: "Open your Evidence Ledger",
        url: `${baseUrl()}/app/evidence`,
      },
      footnote:
        "Everything here runs in Manual Mode by default: it costs nothing and needs no API key. " +
        defaultFootnote(),
    }),
    text: [
      greeting,
      "",
      "Your account is ready.",
      "Start with the Evidence Ledger. It holds what is factually true about your career, " +
        "and every other part of the product is only allowed to use that.",
      "",
      `Open your Evidence Ledger: ${baseUrl()}/app/evidence`,
      "",
      "Everything here runs in Manual Mode by default: it costs nothing and needs no API key.",
    ].join("\n"),
  };
}

export function accountNoticeEmail(options: {
  name: string | null;
  heading: string;
  detail: string;
}): RenderedEmail {
  const greeting = options.name ? `Hi ${options.name},` : "Hi,";
  return {
    subject: `Important: ${options.heading}`,
    html: layout({
      heading: options.heading,
      intro: greeting,
      body: options.detail,
      cta: { label: "Review your account", url: `${baseUrl()}/app/settings` },
      footnote: defaultFootnote(),
    }),
    text: [
      greeting,
      "",
      options.heading,
      options.detail,
      "",
      `Review your account: ${baseUrl()}/app/settings`,
    ].join("\n"),
  };
}
