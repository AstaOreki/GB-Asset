import Stripe from "stripe";

// Whole-order line item rather than one per cart line: Stripe Checkout
// doesn't need per-product Price objects for this to work correctly, and it
// keeps this route agnostic of the cart's actual contents — it only needs
// the total GB Asset already computed client-side.
export async function POST(request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Card payment is not configured yet." }, { status: 501 });
  }

  const body = await request.json();
  const { orderId, amount, customerEmail, origin } = body;
  if (!orderId || !amount || !origin) {
    return Response.json({ error: "Missing orderId, amount, or origin." }, { status: 400 });
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "myr",
            product_data: { name: `GB Asset Order #${orderId}` },
            unit_amount: Math.round(amount * 100),
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
