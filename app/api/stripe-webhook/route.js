import Stripe from "stripe";
import { getAdminDb } from "../../../lib/firebaseAdmin";

// This is the only place an order's status actually flips to "paid" for a
// card payment — never the client redirect back from Stripe, which is
// cosmetic only (see app/checkout/page.jsx). Firestore rules don't let a
// customer update their own order, and this route has no signed-in user
// anyway; it relies on Stripe's signature instead of Firebase Auth to prove
// the request is legitimate, then writes via firebase-admin, which bypasses
// the rules the same way the admin dashboard's own login does.
export async function POST(request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return Response.json({ error: "Stripe not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  const stripe = new Stripe(secretKey);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return Response.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata && session.metadata.orderId;
    if (orderId) {
      const db = getAdminDb();
      if (db) {
        // .update() throws if the order doc doesn't exist (e.g. it was
        // since deleted from the admin dashboard) — that's not something
        // retrying the webhook would ever fix, so swallow it here rather
        // than 500 and have Stripe retry indefinitely.
        await db
          .collection("orders")
          .doc(orderId)
          .update({
            status: "paid",
            stripeSessionId: session.id,
            paidAt: new Date(),
          })
          .catch(() => {});
      }
    }
  }

  return Response.json({ received: true });
}
