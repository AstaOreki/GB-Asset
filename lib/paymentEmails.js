// The 3 emails the manual bank-transfer workflow sends, and nothing else —
// see the Email Workflow rules this implements: Email 1 (order received,
// NOT a confirmation) fires right after checkout; Email 2 (proof
// submitted) fires after a receipt upload; Email 3 (order confirmed) fires
// ONLY from app/api/orders/confirm-payment, after an admin reviews the
// receipt and clicks Confirm. No other code path may call sendResendEmail
// with an "Order Confirmed" subject.
import { Resend } from "resend";
import { BANK_ACCOUNTS } from "./bankAccounts";
import { DELIVERY_LABELS, fmtRM, esc } from "./orderEmailHelpers";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://gbagold.my";
}

function paymentPageUrl(orderId) {
  return `${siteBase()}/orders/${encodeURIComponent(orderId)}/payment`;
}

function wrap(bodyHtml) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    ${bodyHtml}
    <p style="margin-top:24px;color:#777;font-size:13px;">GB Asset — this is an automated email, please keep it for your records.</p>
  </div>`;
}

function itemsTable(order) {
  const itemsRows = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e2e1;">${esc(item.name)} × ${Number(item.qty)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e2e1;text-align:right;">${fmtRM(item.lineTotal)}</td>
        </tr>`
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      ${itemsRows}
      <tr><td style="padding:10px 0;font-weight:bold;border-top:2px solid #1a1a1a;">Total</td><td style="padding:10px 0;text-align:right;font-weight:bold;border-top:2px solid #1a1a1a;">${fmtRM(order.amount)}</td></tr>
    </table>`;
}

// Email 1 — sent immediately after order placement. Explicitly NOT a
// confirmation: says the order was created, payment is pending, and the
// customer still has to transfer manually and upload a receipt.
export function renderOrderReceivedBankEmailHtml(order) {
  return wrap(`
    <h2 style="color:#a67c27;">We received your order, ${esc(order.customer)}</h2>
    <p>Your order <strong>#${esc(order.orderId)}</strong> has been created. It is <strong>not confirmed yet</strong> — you'll need to complete a manual bank transfer and upload your payment receipt before we can process it.</p>
    ${itemsTable(order)}
    <p style="margin:4px 0;"><strong>Delivery method:</strong> ${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)}</p>
    <p style="margin:4px 0;"><strong>Payment method:</strong> Bank Transfer</p>
    <div style="margin:22px 0;padding:18px 20px;border:1px solid #d4af37;border-radius:6px;background:#faf7ee;">
      <p style="margin:0 0 10px;font-weight:bold;color:#a67c27;text-transform:uppercase;font-size:12px;letter-spacing:1px;">Bank Transfer Details</p>
      ${BANK_ACCOUNTS.map(
        (acc) => `
      <p style="margin:0 0 12px;line-height:1.5;">
        <strong>${esc(acc.bank)}</strong><br>
        ${esc(acc.name)}<br>
        Account Number: <strong>${esc(acc.number)}</strong>
      </p>`
      ).join("")}
      <p style="margin:14px 0 0;color:#555;font-size:13px;line-height:1.5;">Please transfer the exact order amount and use your order number as the payment reference. Then upload your payment receipt at the link below — our team will verify it before your order is confirmed.</p>
    </div>
    <p style="margin:20px 0;"><a href="${esc(paymentPageUrl(order.orderId))}" style="color:#a67c27;font-weight:bold;">Upload your payment receipt →</a></p>
  `);
}

// Email 2 — optional but recommended, sent after a receipt upload. Still
// not a confirmation.
export function renderProofSubmittedEmailHtml(order) {
  return wrap(`
    <h2 style="color:#a67c27;">Payment receipt received — Order #${esc(order.orderId)}</h2>
    <p>Hi ${esc(order.customer)}, we received your payment receipt and it is currently being reviewed by our admin. Your order is not confirmed yet — we'll email you again once it's verified.</p>
    <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtRM(order.amount)}</p>
  `);
}

// Email 3 — the official confirmation. Only ever called from
// app/api/orders/confirm-payment, after an admin approves the receipt.
export function renderOrderConfirmedEmailHtml(order) {
  return wrap(`
    <h2 style="color:#a67c27;">Payment Confirmed — Order #${esc(order.orderId)}</h2>
    <p>Hi ${esc(order.customer)}, we've received and verified your bank transfer. Your order is now confirmed and being processed.</p>
    ${itemsTable(order)}
    <p style="margin:4px 0;"><strong>Payment Method:</strong> Bank Transfer</p>
    <p style="margin:4px 0;"><strong>Payment Status:</strong> Confirmed</p>
    <p style="margin:4px 0;"><strong>Confirmed on:</strong> ${esc(order.confirmedDateLabel || "")}</p>
    <p style="margin:4px 0;"><strong>Delivery method:</strong> ${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)}</p>
  `);
}

// Admin-facing — sent to every address in NEXT_PUBLIC_ADMIN_EMAILS the
// moment a customer uploads a receipt, so an order doesn't sit unnoticed in
// the dashboard until someone happens to check it (see app/api/orders/
// upload-receipt). Not one of the 3 customer emails the workflow rules
// govern — this never goes to the customer.
export function renderAdminReceiptUploadedEmailHtml(order) {
  const mismatch =
    typeof order.amountTransferred === "number" && Math.abs(order.amountTransferred - order.amount) > 0.01;
  return wrap(`
    <h2 style="color:#a67c27;">Payment receipt uploaded — Order #${esc(order.orderId)}</h2>
    <p>${esc(order.customer)} uploaded a payment receipt for review.</p>
    <p style="margin:4px 0;"><strong>Order Total:</strong> ${fmtRM(order.amount)}</p>
    <p style="margin:4px 0;"><strong>Amount Transferred:</strong> ${
      typeof order.amountTransferred === "number" ? fmtRM(order.amountTransferred) : "—"
    }</p>
    ${
      mismatch
        ? `<p style="margin:10px 0;padding:10px 14px;border:1px solid #b01829;border-radius:6px;background:#fdeceb;color:#b01829;font-weight:bold;">⚠ Amount mismatch — please check the receipt carefully.</p>`
        : ""
    }
    <p style="margin:20px 0;"><a href="${esc(siteBase())}/admin_dashboard.html" style="color:#a67c27;font-weight:bold;">Review in the admin dashboard →</a></p>
  `);
}

// Reminder for a bank-transfer order that's been "Awaiting Payment" for
// days with no receipt uploaded at all — sent once by the daily cron in
// app/api/orders/stale-payment-reminder, never repeated for the same order
// (see staleReminderSentAt on the order doc).
export function renderStaleOrderReminderEmailHtml(order) {
  return wrap(`
    <h2 style="color:#a67c27;">Reminder: complete your payment — Order #${esc(order.orderId)}</h2>
    <p>Hi ${esc(order.customer)}, your order <strong>#${esc(order.orderId)}</strong> is still awaiting payment. Please complete your bank transfer and upload your receipt so we can process it.</p>
    <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtRM(order.amount)}</p>
    <div style="margin:22px 0;padding:18px 20px;border:1px solid #d4af37;border-radius:6px;background:#faf7ee;">
      <p style="margin:0 0 10px;font-weight:bold;color:#a67c27;text-transform:uppercase;font-size:12px;letter-spacing:1px;">Bank Transfer Details</p>
      ${BANK_ACCOUNTS.map(
        (acc) => `
      <p style="margin:0 0 12px;line-height:1.5;">
        <strong>${esc(acc.bank)}</strong><br>
        ${esc(acc.name)}<br>
        Account Number: <strong>${esc(acc.number)}</strong>
      </p>`
      ).join("")}
    </div>
    <p style="margin:20px 0;"><a href="${esc(paymentPageUrl(order.orderId))}" style="color:#a67c27;font-weight:bold;">Upload your payment receipt →</a></p>
  `);
}

export async function sendResendEmail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !resendFrom) {
    throw new Error("Email service not configured.");
  }
  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({ from: resendFrom, to, subject, html });
  if (error) throw new Error(error.message || "Resend rejected the email.");
}
