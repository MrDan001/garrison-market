// lib/email.ts
// Sends transactional emails via Resend (https://resend.com).
//
// Setup required:
// 1. npm install resend
// 2. Create a Resend account, verify a sending domain (or use their
//    shared onboarding domain for testing).
// 3. Add RESEND_API_KEY to your .env / Vercel project env vars.
// 4. Optionally set EMAIL_FROM (e.g. "Garrison Market <no-reply@yourdomain.com>").
//    Defaults to Resend's test sender, which only works for the email
//    address you signed up with until you verify your own domain.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || "Garrison Market <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!process.env.RESEND_API_KEY) {
    console.error(
      "RESEND_API_KEY is not set — skipping email send. Add it to your environment to enable password reset emails."
    );
    return { success: false, error: "Email service not configured." };
  }

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Reset your Garrison Market password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f1117;">Reset your password</h2>
          <p style="color: #333; font-size: 14px; line-height: 1.6;">
            We received a request to reset the password on your Garrison Market account.
            Click the button below to choose a new password. This link expires in 30 minutes.
          </p>
          <a href="${resetUrl}"
             style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #059669; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Reset Password
          </a>
          <p style="color: #888; font-size: 12px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email — your password will not change.
          </p>
          <p style="color: #888; font-size: 12px;">${resetUrl}</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, error: "Failed to send email." };
  }
}
