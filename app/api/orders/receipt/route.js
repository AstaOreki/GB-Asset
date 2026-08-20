import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { getRequestUser, isAdminEmail } from "../../../../lib/adminAuth";
import { fetchReceiptBlob } from "../../../../lib/blobStorage";

export const runtime = "nodejs";

// GET ?orderId=X — streams the receipt file itself (not a URL). Vercel
// Blob's private store rejects a plain, unauthenticated browser request
// to the blob URL directly (confirmed live), so this route does the
// authenticated fetch server-side and re-serves the bytes — the same
// owner-or-admin check the old Firebase-Storage-era signed-URL route had,
// just returning content instead of a URL to redirect to.
export async function GET(request) {
  const decoded = await getRequestUser(request);
  if (!decoded) return Response.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) return Response.json({ error: "Missing orderId." }, { status: 400 });

  const db = getAdminDb();
  if (!db) return Response.json({ error: "Server not configured." }, { status: 501 });

  let order;
  try {
    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists) return Response.json({ error: "Order not found." }, { status: 404 });
    order = orderSnap.data();
  } catch (err) {
    console.error("receipt: order lookup failed", err);
    return Response.json({ error: "Could not look up this order — please try again." }, { status: 500 });
  }

  const isOwner = order.userId === decoded.uid;
  if (!isOwner && !isAdminEmail(decoded.email)) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }
  if (!order.receiptUrl) return Response.json({ error: "No receipt on file." }, { status: 404 });

  try {
    const { stream, contentType } = await fetchReceiptBlob(order.receiptUrl);
    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${(order.receiptFileName || "receipt").replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("receipt: blob fetch failed", err);
    return Response.json({ error: "Could not load the receipt." }, { status: 500 });
  }
}
