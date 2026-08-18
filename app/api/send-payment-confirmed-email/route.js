import { Resend } from "resend";
import { getAdminDb, verifyIdToken } from "../../../lib/firebaseAdmin";
import { DELIVERY_LABELS, fmtRM, esc } from "../../../lib/orderEmailHelpers";

export const runtime = "nodejs";

// Same admin check as app/api/newsletter/send/route.js and
// app/api/export-sales-report/route.js — sourced from the same env var the
// storefront's inline firebase-config script uses, so it can never drift
// from the real admin list.
function isAdminEmail(email) {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && list.includes(email.toLowerCase());
}

function renderPaymentConfirmedEmailHtml(order) {
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
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#a67c27;">Payment Confirmed — Order #${esc(order.orderId)}</h2>
    <p>Hi ${esc(order.customer)}, we've received and verified your bank transfer. Your order is now confirmed and being processed.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      ${itemsRows}
      <tr><td style="padding:10px 0;font-weight:bold;border-top:2px solid #1a1a1a;">Total Paid</td><td style="padding:10px 0;text-align:right;font-weight:bold;border-top:2px solid #1a1a1a;">${fmtRM(order.amount)}</td></tr>
    </table>
    <p style="margin:4px 0;"><strong>Payment Method:</strong> Bank Transfer</p>
    <p style="margin:4px 0;"><strong>Payment Status:</strong> Verified</p>
    <p style="margin:4px 0;"><strong>Delivery method:</strong> ${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)}</p>
    <p style="margin-top:24px;color:#777;font-size:13px;">GB Asset — this is an automated confirmation, please keep it for your records.</p>
  </div>`;
}

// Admin-only. Body: { orderId }. Loads the order straight from Firestore
// (never trusts client-supplied order data for a "payment confirmed"
// email) and only fires for orders that are actually bank-transfer +
// already marked paid — see public/admin_dashboard.html, which calls this
// right after the admin flips a bank-transfer order's status to "paid"
// via the existing status dropdown. No automatic trigger exists anywhere
// else; a human always has to mark the order paid first.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return Response.json({ error: "Not signed in." }, { status: 401 });

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    decoded = null;
  }
  if (!decoded || !isAdminEmail(decoded.email)) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const orderId = body && body.orderId;
  if (!orderId) return Response.json({ error: "Missing orderId." }, { status: 400 });

  const db = getAdminDb();
  if (!db) return Response.json({ error: "Server not configured." }, { status: 501 });

  const doc = await db.collection("orders").doc(orderId).get();
  if (!doc.exists) return Response.json({ error: "Order not found." }, { status: 404 });
  const order = doc.data();

  if (order.paymentMethod !== "bank") {
    return Response.json({ error: "This order is not a bank transfer order." }, { status: 400 });
  }
  if (order.status !== "paid") {
    return Response.json({ error: "Order must be marked paid before sending this email." }, { status: 400 });
  }
  if (!order.email) {
    return Response.json({ error: "Order has no email on file." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !resendFrom) {
    return Response.json({ error: "Email service not configured." }, { status: 501 });
  }

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: resendFrom,
      to: order.email,
      subject: `Payment Confirmed — Order #${orderId}`,
      html: renderPaymentConfirmedEmailHtml({ ...order, orderId }),
    });
    if (error) throw new Error(error.message || "Resend rejected the email.");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "Failed to send email." }, { status: 500 });
  }
}
