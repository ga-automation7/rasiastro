import { getLanguage, type LanguageCode } from "@/config/languages";
import { formatDate, getDictionary } from "@/i18n";
import { html, join } from "../reports/html";

/**
 * Transactional email bodies. The access link carries its token in the URL fragment
 * (#t=...), which browsers never send to servers, so it cannot end up in access logs
 * or Referer headers. Nothing sensitive (birth data, report text) is put in emails.
 */
function layout(lang: LanguageCode, title: string, inner: ReturnType<typeof html>): string {
  return html`<!doctype html><html lang="${getLanguage(lang).htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;background:#f6f2e9;font-family:'Noto Sans',Arial,sans-serif;color:#1c1a2e;">
<div style="max-width:560px;margin:0 auto;padding:28px 20px;">
  <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a6219;">Rasi Astro</p>
  <div style="background:#ffffff;border-radius:12px;padding:26px 24px;border:1px solid #e7e0cf;">${inner}</div>
  <p style="font-size:12px;color:#7a7466;margin-top:18px;">Rasi Astro · rasiastro.com · Your stars, your story.</p>
</div></body></html>`.value;
}

const button = (href: string, label: string) =>
  html`<p style="margin:22px 0;"><a href="${href}" style="background:#1f1b4d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">${label}</a></p>`;

export function reportReadyEmail(args: { language: LanguageCode; reference: string; link: string; expiresAt: Date; supportEmail: string; traditionLabel: string }) {
  const d = getDictionary(args.language);
  const expiry = formatDate(args.expiresAt.toISOString(), d);
  const subject = d.email.readySubject(args.reference);
  const inner = html`<h1 style="font-size:20px;margin:0 0 12px;color:#1f1b4d;">${subject}</h1>
    <p>${d.email.readyIntro}</p>
    <p style="color:#6b6880;font-size:14px;">${d.email.reportFor(args.reference, args.traditionLabel)}</p>
    ${button(args.link, d.email.openButton)}
    <p style="font-size:13px;color:#6b6880;">${d.email.linkExpiry(expiry)}</p>
    <p style="font-size:13px;color:#6b6880;">${d.email.recoverHint}</p>
    <p style="font-size:13px;">${d.email.support(args.supportEmail)}</p>
    ${args.language !== "en" ? html`<hr style="border:none;border-top:1px solid #eee;margin:18px 0;"><p style="font-size:12px;color:#7a7466;">Your Rasi Astro report ${args.reference} is ready. Use the button above to open it. The link works until ${formatDate(args.expiresAt.toISOString(), getDictionary("en"))}.</p>` : ""}`;
  const text = [subject, "", d.email.readyIntro, "", args.link, "", d.email.linkExpiry(expiry), d.email.recoverHint, d.email.support(args.supportEmail)].join("\n");
  return { subject, html: layout(args.language, subject, inner), text };
}

export function recoveryEmail(args: { links: { reference: string; link: string; traditionLabel: string }[]; supportEmail: string }) {
  const d = getDictionary("en");
  const subject = d.email.recoverySubject;
  const inner = html`<h1 style="font-size:20px;margin:0 0 12px;color:#1f1b4d;">${subject}</h1>
    <p>${d.email.recoveryIntro}</p>
    ${join(args.links.map((l) => html`<p style="margin:14px 0;"><a href="${l.link}" style="color:#1f1b4d;font-weight:600;">${d.email.reportFor(l.reference, l.traditionLabel)}</a></p>`))}
    <p style="font-size:13px;color:#6b6880;">${d.email.recoverHint}</p>
    <p style="font-size:13px;color:#6b6880;">If you did not ask for this, you can ignore this email.</p>
    <p style="font-size:13px;">${d.email.support(args.supportEmail)}</p>`;
  const text = [subject, "", d.email.recoveryIntro, "", ...args.links.map((l) => `${l.reference}: ${l.link}`), "", d.email.recoverHint].join("\n");
  return { subject, html: layout("en", subject, inner), text };
}

