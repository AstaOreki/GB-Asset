import { DELIVERY_LABELS, fmtRM, esc } from "../../../lib/orderEmailHelpers";
import { renderOrderReceivedBankEmailHtml, sendResendEmail } from "../../../lib/paymentEmails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Card/cash orders only — this is a real "your order is confirmed" email
// for those methods. Bank transfer uses renderOrderReceivedBankEmailHtml
// instead (lib/paymentEmails.js), which is explicit that the order is NOT
// confirmed yet, since confirmation only happens after an admin verifies
// the uploaded receipt.
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
    <p style="margin-top:24px;color:#777;font-size:13px;">GB Asset — this is an automated confirmation, please keep it for your records.</p>
  </div>`;
}

export async function POST(request) {
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

  const isBank = order.paymentMethod === "bank";

  try {
    await sendResendEmail({
      to: order.email,
      subject: isBank ? `We received your order — #${order.orderId}` : `Order Confirmation — #${order.orderId}`,
      html: isBank ? renderOrderReceivedBankEmailHtml(order) : renderOrderEmailHtml(order),
    });
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
