import { Resend } from "resend";
import { BANK_ACCOUNTS } from "../../../lib/bankAccounts";
import { DELIVERY_LABELS, fmtRM, esc } from "../../../lib/orderEmailHelpers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Manual bank transfer only — no payment gateway involved. The account
  // numbers have to be in this email too, not just on the confirmation
  // page, since the page is a one-time view but the email is what the
  // customer can come back to when they actually sit down to make the
  // transfer.
  const bankTransferBlock =
    order.paymentMethod === "bank"
      ? `
    <div style="margin:22px 0;padding:18px 20px;border:1px solid #d4af37;border-radius:6px;background:#faf7ee;">
      <p style="margin:0 0 4px;font-weight:bold;color:#1a1a1a;">Payment Status: Pending Verification</p>
      <p style="margin:0 0 14px;color:#555;">Amount to Transfer: <strong>${fmtRM(order.amount)}</strong></p>
      <p style="margin:0 0 10px;font-weight:bold;color:#a67c27;text-transform:uppercase;font-size:12px;letter-spacing:1px;">Bank Transfer Details</p>
      ${BANK_ACCOUNTS.map(
        (acc) => `
      <p style="margin:0 0 12px;line-height:1.5;">
        <strong>${esc(acc.bank)}</strong><br>
        ${esc(acc.name)}<br>
        Account Number: <strong>${esc(acc.number)}</strong>
      </p>`
      ).join("")}
      <p style="margin:14px 0 0;color:#555;font-size:13px;line-height:1.5;">Please transfer the exact order amount to one of the bank accounts above using your preferred banking app or online banking. After completing the transfer, please keep your transaction receipt for verification.</p>
    </div>`
      : "";

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
    ${bankTransferBlock}
    ${order.notes ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${esc(order.notes)}</p>` : ""}
    <p style="margin-top:24px;color:#777;font-size:13px;">GB Asset — this is an automated confirmation, please keep it for your records.</p>
  </div>`;
}

export async function POST(request) {
  // Resend does the actual sending; the "from" address is a Google
  // Workspace mailbox the business already reads (orders@gbagold.my), so
  // any customer reply lands in that real inbox even though Resend, not
  // Workspace/SMTP, is what sent the original message. See README notes
  // at the bottom of this file for what's needed.
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !resendFrom) {
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
  if (!EMAIL_RE.test(order.email)) {
    return Response.json({ error: "Invalid email address." }, { status: 400 });
  }

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: resendFrom,
      to: order.email,
      subject: `Order Confirmation — #${order.orderId}`,
      html: renderOrderEmailHtml(order),
    });
    if (error) throw new Error(error.message || "Resend rejected the email.");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "Failed to send email." }, { status: 500 });
  }
}

// --- What's needed for this route to actually send ---
// 1. RESEND_API_KEY — from the Resend dashboard's API Keys page.
// 2. RESEND_FROM_EMAIL — a sender address on a domain verified in Resend
//    (e.g. "GB Asset <orders@gbagold.my>"), set up via Resend's Domains
//    page (add the SPF/DKIM/DMARC TXT records it gives you to gbagold.my's
//    DNS, then click Verify). Use the same address as the real Workspace
//    mailbox so customer replies land somewhere someone actually reads.
// Both values get added as Vercel environment variables, same as every
// other secret this project uses.
