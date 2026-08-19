import { getAdminDb, getAdminBucket } from "../../../../lib/firebaseAdmin";
import { getRequestUser, isAdminEmail } from "../../../../lib/adminAuth";

export const runtime = "nodejs";

// GET ?orderId=X[&historyId=Y] — mints a short-lived signed URL for one
// receipt file. The customer can only ever see their own order's CURRENT
// receipt; historyId (a past, superseded/rejected attempt) is admin-only,
// matching firestore.rules' receiptHistory subcollection being admin-read-
// only. Nothing is ever made permanently public — see storage.rules.
export async function GET(request) {
  const decoded = await getRequestUser(request);
  if (!decoded) return Response.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const historyId = searchParams.get("historyId");
  if (!orderId) return Response.json({ error: "Missing orderId." }, { status: 400 });

  const db = getAdminDb();
  const bucket = getAdminBucket();
  if (!db || !bucket) return Response.json({ error: "Server not configured." }, { status: 501 });

  const orderRef = db.collection("orders").doc(orderId);
  let order;
  let objectPath;
  let fileName;
  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return Response.json({ error: "Order not found." }, { status: 404 });
    order = orderSnap.data();

    const isOwner = order.userId === decoded.uid;
    const isAdmin = isAdminEmail(decoded.email);
    if (!isOwner && !isAdmin) {
      return Response.json({ error: "Not authorized." }, { status: 403 });
    }

    if (historyId) {
      if (!isAdmin) return Response.json({ error: "Not authorized." }, { status: 403 });
      const historySnap = await orderRef.collection("receiptHistory").doc(historyId).get();
      if (!historySnap.exists) return Response.json({ error: "Receipt not found." }, { status: 404 });
      const entry = historySnap.data();
      objectPath = entry.receiptUrl;
      fileName = entry.receiptFileName;
    } else {
      objectPath = order.receiptUrl;
      fileName = order.receiptFileName;
    }
  } catch {
    return Response.json({ error: "Could not look up this order — please try again." }, { status: 500 });
  }

  if (!objectPath) return Response.json({ error: "No receipt on file." }, { status: 404 });

  try {
    const [url] = await bucket.file(objectPath).getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });
    return Response.json({ url, fileName });
  } catch {
    return Response.json({ error: "Could not load the receipt." }, { status: 500 });
  }
}
