import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { sendNewsletterCore } from "../../../../lib/newsletter";

// Vercel Cron calls this once a day (see vercel.json — 01:00 UTC, which is
// a fixed offset from 09:00 Asia/Kuala_Lumpur since Malaysia has no DST).
// When CRON_SECRET is set as a project env var, Vercel automatically signs
// every cron invocation with "Authorization: Bearer <CRON_SECRET>" — this
// check is what stops anyone else who finds the URL from triggering a real
// send. See the deployment report for how to set CRON_SECRET.
function isAuthorizedCronCall(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — no secret configured means no automated sending
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorizedCronCall(request)) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) return Response.json({ error: "Firebase Admin is not configured." }, { status: 501 });

  // Every newsletter whose scheduled time has arrived. status=="scheduled"
  // already excludes drafts (never auto-sent) and anything mid-flight or
  // finished (sending/sent/failed) — sendNewsletterCore's own transaction
  // is still the real guard against double-sending; this query just decides
  // what's *due*.
  const now = new Date();
  const snap = await db.collection("newsletters").where("status", "==", "scheduled").where("scheduledAt", "<=", now).get();

  if (snap.empty) {
    return Response.json({ ok: true, processed: 0 });
  }

  const results = [];
  for (const doc of snap.docs) {
    try {
      const r = await sendNewsletterCore(doc.id);
      results.push({ id: doc.id, ok: true, ...r });
    } catch (err) {
      // One newsletter failing (e.g. a bad manual price entry) must not
      // stop the rest of the run — each is independent.
      results.push({ id: doc.id, ok: false, error: err.message || String(err) });
    }
  }

  return Response.json({ ok: true, processed: results.length, results });
}
