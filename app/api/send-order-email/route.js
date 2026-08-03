import nodemailer from "nodemailer";
import { Resend } from "resend";

const DELIVERY_LABELS = {
  self: "Self Pickup",
  standard: "Insured Courier",
  express: "Express Insured",
};

function fmtRM(n) {
  return "RM " + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2 });
}

// order.customer/notes/address are free-text fields the customer typed at
// checkout — must be escaped before going into the email HTML, same as the
// admin dashboard already does for order data rendered in the browser.
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function renderOrderEmailHtml(order) {
  const itemsRows = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e2e1;">${esc(item.name)} × ${Number(item.qty)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e2e1;text-align:right;">${fmtRM(item.lineTotal)}</td>
        </tr>`
    )
    .join("");

  const addressBlock =
    order.deliveryMethod === "self"
      ? ""
      : `<p style="margin:4px 0;color:#555;">${[order.address?.line, order.address?.city, order.address?.state, order.address?.postcode]
          .filter(Boolean)
          .map(esc)
          .join(", ")}</p>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#a67c27;">Thank you for your order, ${esc(order.customer)}!</h2>
    <p>Your order <strong>#${esc(order.orderId)}</strong> has been received and is being processed.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      ${itemsRows}
      <tr><td style="padding:10px 0;">Subtotal</td><td style="padding:10px 0;text-align:right;">${fmtRM(order.subtotal)}</td></tr>
      <tr><td style="padding:10px 0;">Delivery (${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)})</td><td style="padding:10px 0;text-align:right;">${fmtRM(order.deliveryFee)}</td></tr>
      <tr><td style="padding:10px 0;font-weight:bold;border-top:2px solid #1a1a1a;">Total</td><td style="padding:10px 0;text-align:right;font-weight:bold;border-top:2px solid #1a1a1a;">${fmtRM(order.amount)}</td></tr>
    </table>
    <p style="margin:4px 0;"><strong>Delivery method:</strong> ${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)}</p>
    ${addressBlock}
    <p style="margin:4px 0;"><strong>Payment method:</strong> ${esc(order.paymentMethod)}</p>
    ${order.notes ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${esc(order.notes)}</p>` : ""}
    <p style="margin-top:24px;color:#777;font-size:13px;">GBA Asset — this is an automated confirmation, please keep it for your records.</p>
  </div>`;
}

async function sendViaWorkspace(workspaceEmail, workspaceAppPassword, order) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: workspaceEmail, pass: workspaceAppPassword },
  });
  await transporter.sendMail({
    from: `GBA Asset <${workspaceEmail}>`,
    to: order.email,
    subject: `Order Confirmation — #${order.orderId}`,
    html: renderOrderEmailHtml(order),
  });
}

async function sendViaResend(apiKey, fromAddress, order) {
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: order.email,
    subject: `Order Confirmation — #${order.orderId}`,
    html: renderOrderEmailHtml(order),
  });
  if (error) throw new Error(error.message || "Resend rejected the email.");
}

export async function POST(request) {
  // Google Workspace (the business's own mailbox, over SMTP) is primary,
  // per instruction. Resend is kept configured as a fallback in case
  // Workspace App Passwords ever get blocked by admin policy or the
  // Workspace send fails for some other reason — see README notes at the
  // bottom of this file for what each one needs.
  const workspaceEmail = process.env.GOOGLE_WORKSPACE_EMAIL;
  const workspaceAppPassword = process.env.GOOGLE_WORKSPACE_APP_PASSWORD;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  const workspaceConfigured = Boolean(workspaceEmail && workspaceAppPassword);
  const resendConfigured = Boolean(resendApiKey && resendFrom);
  if (!workspaceConfigured && !resendConfigured) {
    return Response.json({ error: "Email service not configured." }, { status: 501 });
  }

  let order;
  try {
    order = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!order || !order.email || !order.orderId) {
    return Response.json({ error: "Missing order details." }, { status: 400 });
  }

  if (workspaceConfigured) {
    try {
      await sendViaWorkspace(workspaceEmail, workspaceAppPassword, order);
      return Response.json({ ok: true });
    } catch (err) {
      if (!resendConfigured) {
        return Response.json({ error: err.message || "Failed to send email." }, { status: 500 });
      }
      // fall through to the Resend fallback below
    }
  }

  try {
    await sendViaResend(resendApiKey, resendFrom, order);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "Failed to send email." }, { status: 500 });
  }
}

// --- What's needed for this route to actually send ---
// Primary — Google Workspace:
// 1. GOOGLE_WORKSPACE_EMAIL — the sending mailbox, e.g. orders@gbagold.my
// 2. GOOGLE_WORKSPACE_APP_PASSWORD — a 16-character App Password for that
//    account (Google Account -> Security -> 2-Step Verification -> App
//    passwords). Requires 2-Step Verification to be turned on for that
//    account first. If a Workspace admin has disabled App Passwords
//    org-wide, OAuth2 is required instead — a bigger setup (Google Cloud
//    project + OAuth client + refresh token).
// Fallback — Resend (used only if Workspace isn't configured, or a
// Workspace send throws):
// 3. RESEND_API_KEY — from the Resend dashboard's API Keys page.
// 4. RESEND_FROM_EMAIL — a sender address on a domain verified in Resend
//    (e.g. "GBA Asset <orders@gbagold.my>"), set up via Resend's Domains
//    page (add the SPF/DKIM/DMARC TXT records it gives you to gbagold.my's
//    DNS, then click Verify).
// All four values get added as Vercel environment variables, same as
// every other secret this project uses. Workspace-only or Resend-only
// setups both work fine — the missing pair is just skipped.
