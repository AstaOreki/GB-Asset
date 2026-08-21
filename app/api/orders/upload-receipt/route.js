import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { getRequestUser, getAdminEmails } from "../../../../lib/adminAuth";
import { uploadReceiptBlob } from "../../../../lib/blobStorage";
import { RECEIPT_MIME_TYPES, RECEIPT_MAX_BYTES } from "../../../../lib/paymentStatus";
import { isValidFileSignature } from "../../../../lib/fileSignature";
import {
  renderProofSubmittedEmailHtml,
  renderAdminReceiptUploadedEmailHtml,
  sendResendEmail,
} from "../../../../lib/paymentEmails";

export const runtime = "nodejs";

// Cheap abuse guards for an endpoint that writes to paid Blob storage on
// every call — not meant to stop a determined attacker (that needs a real
// rate limiter), just the two realistic cases: a user double/triple
// clicking "Upload" and a stuck retry loop on a flaky connection.
const UPLOAD_COOLDOWN_MS = 30 * 1000;
const MAX_UPLOADS_PER_ORDER = 10;

function extensionOf(filename) {
  const m = /\.[^.]+$/.exec(filename || "");
  return m ? m[0].toLowerCase() : "";
}

function sanitizeFilename(filename) {
  const base = String(filename || "receipt").replace(/[/\\]/g, "_");
  // Keep it short and boring — this becomes part of a Storage object path.
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

// Customer-only, and only for their own order. Body is multipart form
// data: file, orderId, and the optional bankName/transactionReference/
// amountTransferred fields. Never trusts paymentStatus/amount/etc from the
// client — those are recomputed or looked up here, same reasoning as
// app/api/create-order not trusting a client-supplied price.
export async function POST(request) {
  const decoded = await getRequestUser(request);
  if (!decoded) return Response.json({ error: "Not signed in." }, { status: 401 });

  const db = getAdminDb();
  if (!db) return Response.json({ error: "Server not configured." }, { status: 501 });
  // No upfront credential check here on purpose — @vercel/blob supports two
  // separate ways to authenticate (a plain BLOB_READ_WRITE_TOKEN, or
  // BLOB_STORE_ID + Vercel's ambient VERCEL_OIDC_TOKEN, tried first) and
  // checking for only one of them would wrongly reject a project set up
  // the other way. uploadReceiptBlob()'s own try/catch below surfaces
  // whichever one is actually missing.

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const orderId = form.get("orderId");
  const file = form.get("file");
  const bankName = String(form.get("bankName") || "").trim().slice(0, 80);
  const transactionReference = String(form.get("transactionReference") || "").trim().slice(0, 80);
  const amountTransferredRaw = form.get("amountTransferred");
  const amountTransferred =
    amountTransferredRaw !== null && amountTransferredRaw !== "" && Number.isFinite(Number(amountTransferredRaw))
      ? Number(amountTransferredRaw)
      : null;

  if (!orderId || typeof orderId !== "string") {
    return Response.json({ error: "Missing orderId." }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return Response.json({ error: "Please choose a receipt file to upload." }, { status: 400 });
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return Response.json({ error: "That file is too large — please upload a file under 8MB." }, { status: 400 });
  }
  const allowedExts = RECEIPT_MIME_TYPES[file.type];
  const ext = extensionOf(file.name);
  if (!allowedExts || !allowedExts.includes(ext)) {
    return Response.json({ error: "Only JPG, PNG, or PDF receipts are accepted." }, { status: 400 });
  }

  const orderRef = db.collection("orders").doc(orderId);
  let order;
  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return Response.json({ error: "Order not found." }, { status: 404 });
    order = orderSnap.data();
  } catch (err) {
    console.error("upload-receipt: order lookup failed", err);
    return Response.json({ error: "Could not look up your order — please try again." }, { status: 500 });
  }

  if (order.userId !== decoded.uid) {
    return Response.json({ error: "This is not your order." }, { status: 403 });
  }
  if (order.paymentMethod !== "bank") {
    return Response.json({ error: "This order does not use bank transfer." }, { status: 400 });
  }
  const uploadableStatuses = ["awaiting_payment", "rejected"];
  if (!uploadableStatuses.includes(order.paymentStatus)) {
    return Response.json(
      { error: "A receipt has already been submitted for this order and is under review." },
      { status: 400 }
    );
  }

  if ((order.receiptUploadCount || 0) >= MAX_UPLOADS_PER_ORDER) {
    return Response.json(
      { error: "Too many upload attempts on this order — please contact us directly." },
      { status: 429 }
    );
  }
  const lastUploadMs = order.lastReceiptUploadAt && order.lastReceiptUploadAt.toDate
    ? order.lastReceiptUploadAt.toDate().getTime()
    : 0;
  if (lastUploadMs && Date.now() - lastUploadMs < UPLOAD_COOLDOWN_MS) {
    return Response.json(
      { error: "Please wait a few seconds before uploading again." },
      { status: 429 }
    );
  }

  const timestamp = Date.now();
  const objectPath = `orders/${orderId}/receipts/${timestamp}_${sanitizeFilename(file.name)}`;

  // Every failure here must come back as JSON, not an unhandled exception.
  // An uncaught throw in a Route Handler produces a plain-text/HTML 500
  // page; the client always expects JSON and its res.json() call then
  // throws too, so the real error never reaches the user — they just see
  // a generic "please try again." with no way to know why.
  let receiptUrl;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // Extension/MIME are both just client-supplied labels — a renamed file
    // passes those unchanged. This checks the actual bytes.
    if (!isValidFileSignature(buffer, file.type)) {
      return Response.json(
        { error: "That file doesn't look like a valid JPG, PNG, or PDF." },
        { status: 400 }
      );
    }
    receiptUrl = await uploadReceiptBlob(objectPath, buffer, file.type);
  } catch (err) {
    console.error("upload-receipt: blob upload failed", err);
    return Response.json({ error: "Could not upload your receipt — please try again." }, { status: 500 });
  }

  try {
    await orderRef.update({
      paymentStatus: "proof_submitted",
      bankName,
      transactionReference,
      amountTransferred,
      receiptUrl,
      receiptFileName: file.name,
      receiptUploadedAt: new Date(),
      rejectionReason: null,
      receiptUploadCount: FieldValue.increment(1),
      lastReceiptUploadAt: new Date(),
    });
  } catch (err) {
    console.error("upload-receipt: order update failed", err);
    return Response.json({ error: "Could not save your receipt — please try again." }, { status: 500 });
  }

  // Fire-and-forget, same as the order-placed email — a Resend hiccup must
  // never block the upload itself succeeding.
  if (order.email) {
    sendResendEmail({
      to: order.email,
      subject: `Payment receipt received — Order #${orderId}`,
      html: renderProofSubmittedEmailHtml({ ...order, orderId }),
    }).catch(() => {});
  }
  const adminEmails = getAdminEmails();
  if (adminEmails.length) {
    sendResendEmail({
      to: adminEmails,
      subject: `Payment receipt uploaded — Order #${orderId}`,
      html: renderAdminReceiptUploadedEmailHtml({ ...order, orderId, amountTransferred }),
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}
