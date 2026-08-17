import { verifyIdToken, getAdminDb } from "../../../../lib/firebaseAdmin";
import { sendNewsletterCore, sendTestEmail, isValidEmail } from "../../../../lib/newsletter";

// Same admin check as app/api/export-sales-report/route.js — sourced from
// the same env var the storefront's inline firebase-config script uses, so
// this can never drift from the real admin list.
function isAdminEmail(email) {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && list.includes(email.toLowerCase());
}

/**
 * Admin-only. Body: { mode: "test" | "now", newsletterId, testEmail? }.
 *
 * "test" sends one email to testEmail and never touches Firestore beyond
 * reading the draft — no subscriber is ever contacted, no newsletter
 * status changes. "now" is the real send, routed through the same guarded
 * sendNewsletterCore() the daily cron uses, so there is exactly one send
 * implementation regardless of who/what triggered it.
 */
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return Response.json({ error: "Not signed in." }, { status: 401 });

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    decoded = null;
  }
  if (!decoded || !isAdminEmail(decoded.email)) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { mode, newsletterId, testEmail } = body || {};

  if (mode === "test") {
    if (!newsletterId) return Response.json({ error: "Missing newsletter." }, { status: 400 });
    if (!testEmail || !isValidEmail(testEmail)) {
      return Response.json({ error: "Enter a valid test email address first." }, { status: 400 });
    }
    try {
      const db = getAdminDb();
      if (!db) return Response.json({ error: "Firebase Admin is not configured." }, { status: 501 });
      const doc = await db.collection("newsletters").doc(newsletterId).get();
      if (!doc.exists) return Response.json({ error: "Newsletter not found." }, { status: 404 });
      await sendTestEmail({ ...doc.data() }, testEmail);
      return Response.json({ ok: true, message: `Test email sent to ${testEmail}.` });
    } catch (err) {
      return Response.json({ error: err.message || "Could not send the test email." }, { status: 500 });
    }
  }

  if (mode === "now") {
    if (!newsletterId) return Response.json({ error: "Missing newsletter." }, { status: 400 });
    try {
      const result = await sendNewsletterCore(newsletterId);
      return Response.json({ ok: true, ...result });
    } catch (err) {
      return Response.json({ error: err.message || "Could not send the newsletter." }, { status: 500 });
    }
  }

  return Response.json({ error: 'mode must be "test" or "now".' }, { status: 400 });
}
