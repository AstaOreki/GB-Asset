import Stripe from "stripe";
import { getAdminDb, verifyIdToken } from "../../../lib/firebaseAdmin";

// Whole-order line item rather than one per cart line: Stripe Checkout
// doesn't need per-product Price objects for this to work correctly, and it
// keeps this route agnostic of the cart's actual contents — it only needs
// the total GB Asset already computed client-side.
//
// The charge amount is deliberately never taken from the request — it's
// re-read from the order's own Firestore doc (written by app/api/create-order,
// which itself recomputes it from real product prices; see that file's
// header comment). A route that trusted a client-supplied `amount` here
// would reopen exactly the price-tampering hole create-order was built to
// close, just one hop later in the flow: anyone could POST an arbitrary
// low amount for a real orderId, pay a fraction of the price, and
// app/api/stripe-webhook would mark that order "paid" for real since it
// only checks Stripe's signature, not what the order should have cost.
export async function POST(request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const db = getAdminDb();
  if (!secretKey || !db) {
    return Response.json({ error: "Card payment is not configured yet." }, { status: 501 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    decoded = null;
  }
  if (!decoded) {
    return Response.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { orderId } = body;
  if (!orderId) {
    return Response.json({ error: "Missing orderId." }, { status: 400 });
  }

  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }
  const order = orderSnap.data();
  if (order.userId !== decoded.uid) {
    return Response.json({ error: "This order does not belong to you." }, { status: 403 });
  }
  if (order.status !== "pending") {
    return Response.json({ error: "This order has already been paid or is no longer payable." }, { status: 409 });
  }

  // Derived from the route's own URL rather than trusting a client-supplied
  // origin — Stripe places no restriction on success_url/cancel_url's
  // domain, so a client-controlled origin would let anyone craft a
  // checkout session that redirects a paying customer to an attacker's
  // site after payment.
  const origin = new URL(request.url).origin;

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // No payment_method_types here on purpose: Stripe then shows whatever
      // methods are turned on in Dashboard > Settings > Payment methods for
      // this currency — Apple Pay/Google Pay ride along with "Card"
      // automatically, and enabling FPX/GrabPay/DuitNow there (Malaysia-
      // specific) makes them appear here with no further code changes.
      customer_email: order.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "myr",
            product_data: { name: `GB Asset Order #${orderId}` },
            unit_amount: Math.round(order.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { orderId },
      success_url: `${origin}/checkout?payment=success&orderId=${encodeURIComponent(orderId)}`,
      cancel_url: `${origin}/checkout?payment=cancelled&orderId=${encodeURIComponent(orderId)}`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err.message || "Could not start payment." }, { status: 500 });
  }
}
