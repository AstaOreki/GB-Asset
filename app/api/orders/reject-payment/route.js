import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { getRequestAdmin } from "../../../../lib/adminAuth";

export const runtime = "nodejs";

// Admin-only. Body: { orderId, reason }. Snapshots the receipt being
// rejected into orders/{orderId}/receiptHistory (admin-only subcollection,
// see firestore.rules) before clearing it off the order doc, so the
// customer's re-upload doesn't quietly erase what an admin already looked
// at — "keep previous receipt history for admin only, do not permanently
// delete old receipts."
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
  const reason = String((body && body.reason) || "").trim().slice(0, 300);
  if (!orderId) return Response.json({ error: "Missing orderId." }, { status: 400 });
  if (!reason) return Response.json({ error: "A rejection reason is required." }, { status: 400 });

  const db = getAdminDb();
  if (!db) return Response.json({ error: "Server not configured." }, { status: 501 });

  const orderRef = db.collection("orders").doc(orderId);
  let order;
  try {
    const snap = await orderRef.get();
    if (!snap.exists) return Response.json({ error: "Order not found." }, { status: 404 });
    order = snap.data();
  } catch {
    return Response.json({ error: "Could not look up this order — please try again." }, { status: 500 });
  }

  if (order.paymentMethod !== "bank") {
    return Response.json({ error: "This order does not use bank transfer." }, { status: 400 });
  }
  if (order.paymentStatus !== "proof_submitted" && order.paymentStatus !== "under_review") {
    return Response.json({ error: "There is no submitted receipt to reject." }, { status: 400 });
  }

  const rejectedAt = new Date();

  try {
    await orderRef.collection("receiptHistory").add({
      receiptUrl: order.receiptUrl || null,
      receiptFileName: order.receiptFileName || null,
      receiptUploadedAt: order.receiptUploadedAt || null,
      bankName: order.bankName || "",
      transactionReference: order.transactionReference || "",
      amountTransferred: typeof order.amountTransferred === "number" ? order.amountTransferred : null,
      outcome: "rejected",
      rejectionReason: reason,
      rejectedAt,
      rejectedBy: admin.email,
    });

    await orderRef.update({
      paymentStatus: "rejected",
      rejectionReason: reason,
    });
  } catch {
    return Response.json({ error: "Could not reject this payment — please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
