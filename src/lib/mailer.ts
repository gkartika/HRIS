import nodemailer from "nodemailer";

// Outgoing email over SMTP (Gmail / Google Workspace). Configured with
// environment variables, set once in Vercel:
//   SMTP_HOST (smtp.gmail.com)  SMTP_PORT (465)  SMTP_USER  SMTP_PASS (a Google
//   "App password", not the normal password)  MAIL_FROM  APP_URL
// Not configured in development? The message is printed to the server console
// instead, so the flow can be tried without a mailbox. In production a missing
// configuration is an error — silently "sending" nothing would be worse.
export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function appBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

let transport: nodemailer.Transporter | null = null;

export async function sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Pengiriman email belum dikonfigurasi (SMTP_HOST, SMTP_USER, SMTP_PASS).");
    }
    console.log(`\n[email — SMTP belum diatur, tidak dikirim]\nKepada: ${message.to}\nSubjek: ${message.subject}\n${message.text}\n`);
    return;
  }

  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
