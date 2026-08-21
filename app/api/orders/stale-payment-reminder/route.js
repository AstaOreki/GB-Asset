import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { renderStaleOrderReminderEmailHtml, sendResendEmail } from "../../../../lib/paymentEmails";

// Vercel Cron calls this once a day (see vercel.json). Same
// Authorization-header pattern as app/api/newsletter/cron — see that
// file's header comment for why CRON_SECRET is what gates this.
function isAuthorizedCronCall(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const STALE_DAYS = 3;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

// A bank-transfer order with no receipt uploaded at all just sits in
// "Awaiting Payment" forever with nothing prompting the customer to finish
// it. This nudges them once per order (see staleReminderSentAt) after
// STALE_DAYS with no receiptUrl — it never auto-cancels anything, since
// that's a business call this endpoint isn't positioned to make.
//
// Filtered in memory rather than with a Firestore range query on createdAt
// — paymentMethod/paymentStatus are the only equality filters used here,
// which Firestore can serve without a manual composite index; adding a
// createdAt inequality alongside them would require one.
export async function GET(request) {
  if (!isAuthorizedCronCall(request)) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) return Response.json({ error: "Firebase Admin is not configured." }, { status: 501 });

  const snap = await db
    .collection("orders")
    .where("paymentMethod", "==", "bank")
    .where("paymentStatus", "==", "awaiting_payment")
    .get();

  const now = Date.now();
  const results = [];
  for (const doc of snap.docs) {
    const order = doc.data();
    if (order.receiptUrl || order.staleReminderSentAt) continue;
    const createdMs = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().getTime() : 0;
    if (!createdMs || now - createdMs < STALE_MS) continue;

    try {
      if (order.email) {
        await sendResendEmail({
          to: order.email,
          subject: `Reminder: complete your payment — Order #${doc.id}`,
          html: renderStaleOrderReminderEmailHtml({ ...order, orderId: doc.id }),
        });
      }
      await doc.ref.update({ staleReminderSentAt: new Date() });
      results.push({ id: doc.id, ok: true });
    } catch (err) {
      // One order's reminder failing (bad email, Resend hiccup) must not
      // stop the rest of the run — same reasoning as the newsletter cron.
      results.push({ id: doc.id, ok: false, error: err.message || String(err) });
    }
  }

  return Response.json({ ok: true, processed: results.length, results });
}
