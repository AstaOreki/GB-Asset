import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { getRequestAdmin } from "../../../../lib/adminAuth";
import { renderOrderConfirmedEmailHtml, sendResendEmail } from "../../../../lib/paymentEmails";

export const runtime = "nodejs";

// Admin-only. Body: { orderId }. The transaction is what makes "prevent
// duplicate confirmation if the button is clicked twice" actually true —
// two near-simultaneous requests can't both observe paymentStatus as
// something-other-than-"confirmed" and both proceed; only one write wins,
// and the email fires only for the request whose transaction determined
// the order wasn't already confirmed.
export async function POST(request) {
  const admin = await getRequestAdmin(request);
  if (!admin) return Response.json({ error: "Not authorized." }, { status: 403 });

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

  const orderRef = db.collection("orders").doc(orderId);
  const confirmedAt = new Date();

  let outcome;
  let orderData;
  try {
    outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) return { error: "not_found" };
      const order = snap.data();
      orderData = order;

      if (order.paymentMethod !== "bank") return { error: "not_bank" };
      if (order.paymentStatus === "confirmed") return { alreadyConfirmed: true };
      if (order.paymentStatus !== "proof_submitted" && order.paymentStatus !== "under_review") {
        return { error: "no_receipt" };
      }

      tx.update(orderRef, {
        paymentStatus: "confirmed",
        status: "paid",
        paymentConfirmedAt: confirmedAt,
        paymentConfirmedBy: admin.email,
      });
      return { confirmed: true };
    });
  } catch {
    return Response.json({ error: "Could not confirm this order — please try again." }, { status: 500 });
  }

  if (outcome.error === "not_found") return Response.json({ error: "Order not found." }, { status: 404 });
  if (outcome.error === "not_bank") {
    return Response.json({ error: "This order does not use bank transfer." }, { status: 400 });
  }
  if (outcome.error === "no_receipt") {
    return Response.json({ error: "The customer has not submitted a payment receipt yet." }, { status: 400 });
  }
  if (outcome.alreadyConfirmed) {
    return Response.json({ ok: true, alreadyConfirmed: true });
  }

  if (orderData && orderData.email) {
    const confirmedDateLabel = confirmedAt.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kuala_Lumpur",
    });
    sendResendEmail({
      to: orderData.email,
      subject: `Payment Confirmed — Order #${orderId}`,
      html: renderOrderConfirmedEmailHtml({ ...orderData, orderId, confirmedDateLabel }),
    }).catch(() => {});
  }

  return Response.json({ ok: true, alreadyConfirmed: false });
}
