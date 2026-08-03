import { getAdminAuth, getAdminDb } from "../../../lib/firebaseAdmin";
import { DELIVERY_FEES, computeDeliveryFee, getServerProducts } from "../../../lib/catalog";

// Order creation moved server-side so the price a customer is actually
// charged can never be set by the client. GBA.orders.create() (still used
// by the admin dashboard's manual "New Order" quick-add) writes straight
// to Firestore from the browser with whatever amount/price the caller
// hands it — fine for a trusted admin typing in a phone-order total by
// hand, but for the public storefront checkout, firestore.rules could
// only ever check status/createdAt/userId, never that the amount matched
// real product prices. A customer could open devtools and call the
// Firestore SDK directly with a doctored amount and it would have been
// accepted. This route re-derives every price from the same products
// collection GBA.getProducts() reads from, ignoring whatever price/amount
// the client sent, and is now the only way a non-admin can create an
// order — see firestore.rules, where orders' create rule is admin-only.
export const runtime = "nodejs";

function generateOrderId() {
  const d = new Date();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return "GBA-" + d.getFullYear() + "-" + rand;
}

const PAYMENT_METHODS = new Set(["bank", "card", "cash"]);

export async function POST(request) {
  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) {
    return Response.json({ error: "Server not configured." }, { status: 501 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return Response.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { items, deliveryMethod, paymentMethod, customer, phone, email, notes, address } = body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "Cart is empty." }, { status: 400 });
  }
  if (!Object.prototype.hasOwnProperty.call(DELIVERY_FEES, deliveryMethod)) {
    return Response.json({ error: "Invalid delivery method." }, { status: 400 });
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return Response.json({ error: "Invalid payment method." }, { status: 400 });
  }
  const customerName = String(customer || "").trim();
  const customerPhone = String(phone || "").trim();
  const customerEmail = String(email || "").trim();
  if (!customerName || !customerPhone || !customerEmail) {
    return Response.json({ error: "Missing name, phone, or email." }, { status: 400 });
  }

  const products = await getServerProducts(db);

  const lineItems = [];
  for (const line of items) {
    const id = line && line.id;
    const qty = Math.floor(Number(line && line.qty));
    const product = products[id];
    if (!product || !Number.isFinite(qty) || qty < 1 || qty > 99) {
      return Response.json({ error: "Invalid item in cart." }, { status: 400 });
    }
    lineItems.push({ id, name: product.name, qty, price: product.price, lineTotal: product.price * qty });
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.lineTotal, 0);
  const deliveryFee = computeDeliveryFee(deliveryMethod, subtotal);
  const amount = subtotal + deliveryFee;

  // generateOrderId() is a 6-digit random suffix — collisions are rare but
  // not impossible, and .set() on an existing doc silently overwrites it
  // rather than erroring. Retry on the rare collision instead of risking a
  // clobbered order.
  let orderId;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateOrderId();
    const existing = await db.collection("orders").doc(candidate).get();
    if (!existing.exists) {
      orderId = candidate;
      break;
    }
  }
  if (!orderId) {
    return Response.json({ error: "Could not generate a unique order ID, please try again." }, { status: 500 });
  }

  const order = {
    id: orderId,
    userId: decoded.uid,
    status: "pending",
    customer: customerName,
    phone: customerPhone,
    email: customerEmail,
    deliveryMethod,
    deliveryFee,
    paymentMethod,
    address:
      address && typeof address === "object"
        ? {
            line: String(address.line || ""),
            city: String(address.city || ""),
            state: String(address.state || ""),
            postcode: String(address.postcode || ""),
          }
        : { line: "", city: "", state: "", postcode: "" },
    notes: String(notes || "").trim(),
    items: lineItems,
    product: lineItems.map((i) => i.name).join(", "),
    subtotal,
    amount,
    createdAt: new Date(),
  };

  await db.collection("orders").doc(orderId).set(order);

  return Response.json({ orderId, items: lineItems, subtotal, deliveryFee, amount });
}
