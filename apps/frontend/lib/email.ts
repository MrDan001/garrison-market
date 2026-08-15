// lib/email.ts
// Sends transactional emails via Resend (https://resend.com).
//
// Setup required:
// 1. npm install resend   (already in package.json)
// 2. Create a Resend account, verify a sending domain (or use their
//    shared onboarding domain for testing).
// 3. Add RESEND_API_KEY to your .env / hosting provider's env vars.
// 4. Optionally set EMAIL_FROM (e.g. "Garrison Market <no-reply@yourdomain.com>").
//    Defaults to Resend's test sender, which only works for the email
//    address you signed up with until you verify your own domain.

import { Resend } from "resend";
import { renderMessageBodyHtml } from "./message-links";

const FROM = process.env.EMAIL_FROM || "Garrison Market <onboarding@resend.dev>";

// --- Brand ---
const INK = "#0f1117";
const BRAND = "#059669"; // emerald — matches the app's primary accent

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

type SendResult = { success: boolean; error?: string };

async function send(to: string, subject: string, html: string, replyTo?: string): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error(`RESEND_API_KEY is not set — skipping email "${subject}" to ${to}.`);
    return { success: false, error: "Email service not configured." };
  }

  try {
    await getResendClient().emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return { success: true };
  } catch (error) {
    console.error(`Failed to send email "${subject}" to ${to}:`, error);
    return { success: false, error: "Failed to send email." };
  }
}

// Domain used for generated inbound reply addresses, e.g.
// reply+msg123-owner45@mail.yourdomain.com. Defaults to the domain half of
// EMAIL_FROM so there's one less env var to configure, but you can override
// with RESEND_REPLY_DOMAIN if replies should land on a different subdomain
// than normal outbound mail is sent from.
export function getReplyDomain(): string {
  if (process.env.RESEND_REPLY_DOMAIN) return process.env.RESEND_REPLY_DOMAIN;
  const match = FROM.match(/@([^ >]+)/);
  return match ? match[1] : "yourdomain.com";
}

// Builds the unique per-thread Reply-To address for an admin message thread.
// Encodes both the message and the owner so a reply can be routed straight
// back to the correct (messageId, ownerId) thread with no lookup ambiguity —
// this matters because a single "all_owners" AdminMessage fans out to many
// owners, each of whom needs their own private reply address.
export function getAdminMessageReplyAddress(messageId: number, ownerId: number): string {
  return `reply+msg${messageId}-owner${ownerId}@${getReplyDomain()}`;
}

// --- Shared visual wrapper so every email feels like one brand ---

function layout(opts: {
  preheader?: string;
  badge?: { label: string; color: string };
  body: string;
}) {
  return `
  <div style="background:#f4f5f7; padding:32px 16px; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;">
    ${
      opts.preheader
        ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${opts.preheader}</div>`
        : ""
    }
    <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:${INK}; padding:22px 32px;">
        <table width="100%" style="border-collapse:collapse;"><tr>
          <td style="color:#fff; font-size:17px; font-weight:700; letter-spacing:0.2px;">Garrison Market</td>
          <td style="text-align:right;">
            ${
              opts.badge
                ? `<span style="background:${opts.badge.color}; color:#fff; font-size:11px; font-weight:700; padding:5px 12px; border-radius:999px; text-transform:uppercase; letter-spacing:0.5px;">${opts.badge.label}</span>`
                : ""
            }
          </td>
        </tr></table>
      </div>
      <div style="padding:32px;">
        ${opts.body}
      </div>
      <div style="padding:18px 32px; border-top:1px solid #eee;">
        <p style="color:#9aa0a6; font-size:12px; margin:0;">Garrison Market — retail management made simple.</p>
      </div>
    </div>
  </div>`;
}

function button(url: string, label: string, color: string = BRAND) {
  return `<a href="${url}" style="display:inline-block; margin:20px 0 8px; padding:12px 28px; background:${color}; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px;">${label}</a>`;
}

function heading(text: string) {
  return `<h2 style="color:${INK}; font-size:20px; margin:0 0 12px;">${text}</h2>`;
}

function paragraph(text: string) {
  return `<p style="color:#3d4148; font-size:14px; line-height:1.65; margin:0 0 12px;">${text}</p>`;
}

function fineprint(text: string) {
  return `<p style="color:#9aa0a6; font-size:12px; line-height:1.6; margin:16px 0 0;">${text}</p>`;
}

// =====================================================================
// 1. PASSWORD RESET  (already existed — refactored onto the shared layout)
// =====================================================================

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = layout({
    preheader: "Reset your Garrison Market password.",
    body: `
      ${heading("Reset your password")}
      ${paragraph(
        "We received a request to reset the password on your Garrison Market account. Click the button below to choose a new password. This link expires in 30 minutes."
      )}
      ${button(resetUrl, "Reset Password")}
      ${fineprint("If you didn't request this, you can safely ignore this email — your password will not change.")}
      ${fineprint(resetUrl)}
    `,
  });
  return send(to, "Reset your Garrison Market password", html);
}

// =====================================================================
// 2. OWNER WELCOME  (sent right after a new owner registers)
// =====================================================================

export async function sendOwnerWelcomeEmail(to: string, fullName: string) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: "Welcome to Garrison Market — your account is being reviewed.",
    badge: { label: "Pending Review", color: "#d97706" },
    body: `
      ${heading(`Welcome, ${firstName} 🎉`)}
      ${paragraph(
        "Thanks for signing up for Garrison Market! Your account has been created and is now waiting for a quick review by our team — this usually doesn't take long."
      )}
      ${paragraph("Here's what happens next:")}
      <table style="width:100%; border-collapse:collapse; margin:4px 0 16px;">
        <tr>
          <td style="padding:8px 0; font-size:14px; color:#3d4148; border-bottom:1px solid #f1f2f4;">✅ Account created</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-size:14px; color:#3d4148; border-bottom:1px solid #f1f2f4;">🔍 Our team reviews your details</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-size:14px; color:#3d4148;">📬 You'll get an email the moment you're approved</td>
        </tr>
      </table>
      ${paragraph("Once approved, you'll be able to add inventory, invite staff, and start recording sales right away.")}
      ${fineprint("Questions in the meantime? Just reply to this email.")}
    `,
  });
  return send(to, `Welcome to Garrison Market, ${firstName}!`, html);
}

// =====================================================================
// 3. OWNER STATUS CHANGE — 3 distinct emails
// =====================================================================

export async function sendOwnerApprovedEmail(to: string, fullName: string, loginUrl: string) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: "Your Garrison Market account has been approved.",
    badge: { label: "Approved", color: BRAND },
    body: `
      ${heading(`You're all set, ${firstName}!`)}
      ${paragraph(
        "Good news — your Garrison Market account has been reviewed and approved. You can log in right now and start managing your store."
      )}
      ${button(loginUrl, "Log In to Garrison Market")}
      ${fineprint("Tip: add your first inventory items and invite your staff to get the most out of your first week.")}
    `,
  });
  return send(to, "Your Garrison Market account is approved", html);
}

export async function sendOwnerDeclinedEmail(to: string, fullName: string) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: "An update on your Garrison Market application.",
    badge: { label: "Declined", color: "#dc2626" },
    body: `
      ${heading(`Hi ${firstName},`)}
      ${paragraph(
        "After reviewing your Garrison Market application, we're not able to approve your account at this time."
      )}
      ${paragraph("If you believe this is a mistake or would like more information, just reply to this email — we're happy to take another look.")}
    `,
  });
  return send(to, "Update on your Garrison Market application", html);
}

export async function sendOwnerSuspendedEmail(to: string, fullName: string) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: "Your Garrison Market account has been suspended.",
    badge: { label: "Suspended", color: "#e11d48" },
    body: `
      ${heading(`Hi ${firstName},`)}
      ${paragraph(
        "Your Garrison Market account has been suspended and access is temporarily paused for you and your staff."
      )}
      ${paragraph("If you'd like to understand why or request reinstatement, just reply to this email and our team will follow up.")}
    `,
  });
  return send(to, "Your Garrison Market account has been suspended", html);
}

// =====================================================================
// 4. STAFF INVITE  (owner creates a staff account — sends login creds)
// =====================================================================

export async function sendStaffInviteEmail(
  to: string,
  fullName: string,
  params: { tempPassword: string; loginUrl: string; storeName?: string }
) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: "You've been added to Garrison Market.",
    badge: { label: "Staff Account", color: "#2563eb" },
    body: `
      ${heading(`Welcome aboard, ${firstName}`)}
      ${paragraph(
        `You've been added as staff${params.storeName ? ` at <strong>${params.storeName}</strong>` : ""} on Garrison Market. Here are your login details:`
      )}
      <div style="background:#f8f9fb; border:1px solid #eee; border-radius:10px; padding:16px 20px; margin:8px 0 16px;">
        <p style="margin:0 0 6px; font-size:13px; color:#888;">Email</p>
        <p style="margin:0 0 14px; font-size:15px; color:${INK}; font-weight:600;">${to}</p>
        <p style="margin:0 0 6px; font-size:13px; color:#888;">Temporary password</p>
        <p style="margin:0; font-size:15px; color:${INK}; font-weight:600; font-family: monospace;">${params.tempPassword}</p>
      </div>
      ${button(params.loginUrl, "Log In Now")}
      ${fineprint("For security, please change this password as soon as you log in.")}
    `,
  });
  return send(to, "You've been added to Garrison Market", html);
}

// =====================================================================
// 5. CONSIGNMENT SETTLEMENT  (owner-only — sent when staff settle one)
// =====================================================================

export async function sendConsignmentSettlementEmail(
  to: string,
  ownerFullName: string,
  params: {
    recipientName: string;
    storeName?: string;
    totalSales: number;
    items: { name: string; quantitySold: number; quantityReturned: number; subtotal: number }[];
    link: string;
  }
) {
  const firstName = ownerFullName?.split(" ")[0] || "there";
  const naira = (n: number) => `₦${n.toLocaleString()}`;

  const rows = params.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0; font-size:13px; color:#3d4148; border-bottom:1px solid #f1f2f4;">${i.name}</td>
        <td style="padding:8px 0; font-size:13px; color:#3d4148; text-align:right; border-bottom:1px solid #f1f2f4;">${i.quantitySold}</td>
        <td style="padding:8px 0; font-size:13px; color:#3d4148; text-align:right; border-bottom:1px solid #f1f2f4;">${i.quantityReturned}</td>
        <td style="padding:8px 0; font-size:13px; color:${INK}; text-align:right; font-weight:600; border-bottom:1px solid #f1f2f4;">${naira(i.subtotal)}</td>
      </tr>`
    )
    .join("");

  const html = layout({
    preheader: `Consignment with ${params.recipientName} was settled.`,
    badge: { label: "Consignment Settled", color: "#4f46e5" },
    body: `
      ${heading(`Hi ${firstName},`)}
      ${paragraph(
        `A consignment with <strong>${params.recipientName}</strong>${params.storeName ? ` (${params.storeName})` : ""} has just been settled.`
      )}
      <table style="width:100%; border-collapse:collapse; margin:8px 0;">
        <thead>
          <tr>
            <th style="text-align:left; font-size:11px; color:#9aa0a6; padding:6px 0; border-bottom:1px solid #eee;">Item</th>
            <th style="text-align:right; font-size:11px; color:#9aa0a6; padding:6px 0; border-bottom:1px solid #eee;">Sold</th>
            <th style="text-align:right; font-size:11px; color:#9aa0a6; padding:6px 0; border-bottom:1px solid #eee;">Returned</th>
            <th style="text-align:right; font-size:11px; color:#9aa0a6; padding:6px 0; border-bottom:1px solid #eee;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%; border-collapse:collapse; margin:8px 0 4px;">
        <tr>
          <td style="font-size:14px; color:${INK}; font-weight:700; padding-top:10px;">Total sales</td>
          <td style="font-size:16px; color:${BRAND}; font-weight:700; text-align:right; padding-top:10px;">${naira(params.totalSales)}</td>
        </tr>
      </table>
      ${button(params.link, "View Consignments")}
    `,
  });
  return send(to, `Consignment settled — ${naira(params.totalSales)} in sales`, html);
}

// =====================================================================
// 6. ADMIN BROADCAST / MAILBOX MESSAGE  (admin -> one or all owners)
// =====================================================================
// Mirrors what's saved in AdminMessage / shown on /owner/messages — same
// subject, body, optional link, optional image. The in-app mailbox is
// the permanent copy; this email is just the "you've got a message"
// alert, so it always points back to the full message rather than
// trying to be the whole experience itself.

export async function sendAdminBroadcastEmail(
  to: string,
  ownerFullName: string,
  params: {
    subject: string;
    body: string;
    link?: string | null;
    imageUrl?: string | null;
    messageUrl: string;
    replyTo?: string;
    baseUrl: string;
  }
) {
  const firstName = ownerFullName?.split(" ")[0] || "there";

  // params.body can carry inline [label](url) links (same syntax the
  // in-app MessageBody component and the compose screen's Insert Link
  // button use) — renderMessageBodyHtml turns those into real <a> tags and
  // escapes everything else, so this can never inject markup into the email.
  const bodyHtml = renderMessageBodyHtml(params.body, params.baseUrl);

  const html = layout({
    preheader: params.subject,
    body: `
      ${paragraph(`Hi ${firstName},`)}
      ${paragraph(bodyHtml)}
      ${
        params.imageUrl
          ? `<img src="${params.imageUrl}" alt="" style="width:100%; max-width:416px; border-radius:10px; margin:8px 0 16px; display:block;">`
          : ""
      }
      ${params.link ? button(params.link, "Open Link") : ""}
      ${button(params.messageUrl, "View in Garrison Market", "#0f1117")}
      ${params.replyTo ? fineprint("Just reply to this email to send a response — it'll show up right in the app.") : ""}
    `,
  });
  // replyTo set → any Gmail/Outlook/etc. reply lands on the unique per-owner
  // thread address instead of going back to the shared FROM inbox.
  return send(to, params.subject, html, params.replyTo);
}

// =====================================================================
// 7. ADMIN MESSAGE THREAD REPLY  (either direction — admin <-> owner)
// =====================================================================
// Sent whenever either side replies from inside the app itself. Keeps the
// same Reply-To as the original broadcast so the email thread stays intact
// no matter how many times it goes back and forth.

export async function sendAdminMessageReplyEmail(
  to: string,
  params: {
    recipientFirstName: string;
    authorLabel: string; // e.g. "Garrison Market Support" or the owner's name
    subject: string;
    body: string;
    messageUrl: string;
    replyTo?: string;
  }
) {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = escapeHtml(params.body).replace(/\n/g, "<br>");

  const html = layout({
    preheader: `${params.authorLabel} replied: ${params.body.slice(0, 80)}`,
    badge: { label: "New Reply", color: "#4f46e5" },
    body: `
      ${heading(`${params.authorLabel} replied`)}
      ${paragraph(`Hi ${params.recipientFirstName},`)}
      ${paragraph(bodyHtml)}
      ${button(params.messageUrl, "View & Reply in Garrison Market", "#0f1117")}
      ${params.replyTo ? fineprint("You can also just reply to this email.") : ""}
    `,
  });
  return send(to, `Re: ${params.subject}`, html, params.replyTo);
}

// =====================================================================
// 100-DAY WAITLIST (Stage 6)
// =====================================================================

// Sent right after someone joins the waitlist. Gives them their queue
// position and their own referral link so sharing it is one tap away
// instead of them having to dig it back up from the thank-you page.
export async function sendWaitlistConfirmationEmail(
  to: string,
  fullName: string,
  referralLink: string,
  position: number
) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: `You're number ${position} in line for Garrison Market.`,
    badge: { label: "You're on the list", color: BRAND },
    body: `
      ${heading(`You're in, ${firstName}.`)}
      ${paragraph(
        `You're currently number <strong>${position.toLocaleString()}</strong> in line for Garrison Market. We'll email you the moment a spot opens.`
      )}
      ${paragraph("Want to move up? Share your personal link — everyone who joins through it moves you further up the queue.")}
      ${button(referralLink, "Copy Your Referral Link")}
      ${fineprint(referralLink)}
    `,
  });
  return send(to, `You're #${position} on the Garrison Market waitlist`, html);
}

// One-off update to the whole waitlist (e.g. "we just crossed 1,000
// signups"), sent by an admin via sendWaitlistMilestoneAction in
// lib/waitlist.actions.ts. Single-recipient, same as
// sendAdminBroadcastEmail — the caller loops this over every signup
// with Promise.allSettled rather than one email with hundreds of
// recipients, so nobody's address is exposed to anyone else on the
// list.
export async function sendWaitlistMilestoneEmail(
  to: string,
  fullName: string,
  params: { subject: string; body: string }
) {
  const firstName = fullName?.split(" ")[0] || "there";
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = escapeHtml(params.body).replace(/\n/g, "<br>");

  const html = layout({
    preheader: params.subject,
    body: `
      ${paragraph(`Hi ${firstName},`)}
      ${paragraph(bodyHtml)}
      ${fineprint("You're receiving this because you're on the Garrison Market waitlist.")}
    `,
  });
  return send(to, params.subject, html);
}

// Sent by releaseWaitlistAction (Stage 7) — a real, working link to
// register, once an admin has both opened the gate AND deliberately
// released the list. Distinct from sendWaitlistConfirmationEmail
// (which just confirms they joined) and from the gate toggle itself
// (which never emails anyone at all).
export async function sendWaitlistInviteEmail(to: string, fullName: string, registerUrl: string) {
  const firstName = fullName?.split(" ")[0] || "there";
  const html = layout({
    preheader: "Your spot on Garrison Market is ready.",
    badge: { label: "Your spot is ready", color: BRAND },
    body: `
      ${heading(`You're up, ${firstName}!`)}
      ${paragraph(
        "Thanks for waiting — your spot on Garrison Market is ready. Click below to create your account and start setting up your shop."
      )}
      ${button(registerUrl, "Create Your Account")}
      ${fineprint("This link works for you specifically — no code needed.")}
    `,
  });
  return send(to, "Your Garrison Market spot is ready", html);
}