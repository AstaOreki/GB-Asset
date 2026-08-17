// Server-only newsletter logic: subscriber upsert/unsubscribe, gold-price
// snapshot, HTML email rendering, and the guarded send routine. Imported by
// app/api/newsletter/* routes only — never by client code, since it pulls in
// firebase-admin and (indirectly, via the caller) the Resend API key.
import { Resend } from "resend";
import { getAdminDb } from "./firebaseAdmin";
import { dailySeries, shiftKey } from "./priceSeries";

// Same pattern app/api/send-order-email/route.js already validates
// order.email against — one "good enough" email regex for the project
// rather than two subtly different ones.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_RE.test(email) && email.length <= 254;
}

// crypto.randomUUID() (no external dependency) gives 122 bits of randomness
// — unguessable enough that an unsubscribe link can be trusted on its own
// without also requiring the visitor to be signed in.
export function generateUnsubscribeToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

// Malaysia has no DST, so "today" here is always a fixed UTC+8 offset from
// the instant the function runs, matching the MY-day keys priceHistory is
// already indexed by (see public/js/gba-firebase.js's todayKey()/dateKeyFor
// and lib/priceSeries.js's header comment for why this must not be the
// server's local time).
function myTodayKey() {
  const MY_OFFSET_MS = 8 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + MY_OFFSET_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
}

/**
 * Today's live 1g gold price and its change from the most recent earlier
 * day, reusing the EXACT carry-forward algorithm the storefront's Price
 * Today chart/comparison already run (lib/priceSeries.js) — not a second
 * pricing system. Only the data-fetch is different: a one-shot admin-SDK
 * read here instead of the client SDK's onSnapshot the storefront uses.
 *
 * Returns null if there is no priceHistory at all yet (nothing to show —
 * never fabricates a price).
 */
export async function getGoldPriceSnapshot(db) {
  const today = myTodayKey();
  const start = shiftKey(today, -14); // two weeks is ample to find a prior day to diff against
  const snap = await db.collection("priceHistory").where("date", "<=", today).where("date", ">=", start).get();
  const records = snap.docs.map((d) => d.data());

  const series = dailySeries(records, 1, start, today); // weight 1 = the 1g bar, same "price per gram" the header/calculator key off
  if (!series.length) return null;
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;

  const price = last.pricePerGram;
  const change = prev ? price - prev.pricePerGram : 0;
  const percent = prev && prev.pricePerGram > 0 ? (change / prev.pricePerGram) * 100 : 0;
  return { price, change, percent, asOf: last.date, source: last.source };
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Strips tags rather than allowing a curated subset — admin content isn't
// meant to carry markup (the Create Newsletter form is plain text fields,
// not a rich editor), so the safest sanitization for "content admins typed
// into a textarea" is to not interpret it as HTML at all. Line breaks are
// preserved as <br> after escaping, so paragraphs still read naturally.
function sanitizeToHtml(text) {
  return esc(text).replace(/\r\n|\r|\n/g, "<br>");
}

function fmtRM(n) {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BRAND_GOLD = "#D4AF37";
const BRAND_GOLD_LIGHT = "#F0CD6B";
const BRAND_INK = "#060607";
const BRAND_CHARCOAL = "#141416";

/**
 * The email itself. Table-based layout (not flexbox/grid) and inline
 * styles throughout — the only layout approach that renders consistently
 * across Outlook/Gmail/Apple Mail, none of which reliably support modern
 * CSS. The wordmark is rendered as text (see the header block below), not
 * an image — "do not use external images that may break" is satisfied
 * trivially by not depending on one for the logo at all.
 */
export function renderNewsletterHtml({ title, content, marketUpdate, goldPrice, ctaText, ctaUrl, imageUrl, unsubscribeUrl }) {
  const hasPrice = goldPrice && typeof goldPrice.price === "number";
  const changeUp = hasPrice && goldPrice.change > 0;
  const changeDown = hasPrice && goldPrice.change < 0;
  const changeColor = changeUp ? "#3fae6a" : changeDown ? "#c0394d" : "#9C9384";
  const changeArrow = changeUp ? "▲" : changeDown ? "▼" : "—";

  const priceBlock = hasPrice
    ? `
    <tr><td style="padding:0 40px 28px;">
      <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background:${BRAND_CHARCOAL};border:1px solid rgba(212,175,55,.35);border-radius:6px;">
        <tr><td style="padding:26px 28px;text-align:center;">
          <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND_GOLD_LIGHT};">Gold Price Today</p>
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;color:#F6F1E4;">${fmtRM(goldPrice.price)}<span style="font-size:16px;color:#9C9384;">/g</span></p>
          <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${changeColor};">${changeArrow} ${fmtRM(Math.abs(goldPrice.change))} (${goldPrice.percent >= 0 ? "+" : ""}${goldPrice.percent.toFixed(2)}%)</p>
        </td></tr>
      </table>
    </td></tr>`
    : "";

  const imageBlock = imageUrl
    ? `<tr><td style="padding:0 40px 24px;"><img src="${esc(imageUrl)}" alt="" width="520" style="display:block;width:100%;max-width:520px;border-radius:6px;"/></td></tr>`
    : "";

  const marketBlock = marketUpdate
    ? `
    <tr><td style="padding:0 40px 28px;">
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND_GOLD_LIGHT};">Market Update</p>
      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#D3C9AF;">${sanitizeToHtml(marketUpdate)}</p>
    </td></tr>`
    : "";

  const ctaBlock =
    ctaText && ctaUrl
      ? `
    <tr><td style="padding:0 40px 32px;text-align:center;">
      <a href="${esc(ctaUrl)}" style="display:inline-block;padding:15px 36px;background:${BRAND_GOLD};color:${BRAND_INK};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:3px;">${esc(ctaText)}</a>
    </td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0c0c0d;">
<table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background:#0c0c0d;">
<tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" role="presentation" width="600" style="max-width:600px;width:100%;background:${BRAND_INK};border:1px solid rgba(212,175,55,.25);border-radius:8px;overflow:hidden;">

  <tr><td style="padding:36px 40px 8px;text-align:center;border-bottom:1px solid rgba(212,175,55,.18);padding-bottom:28px;">
    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:1px;color:#F6F1E4;">GB <span style="color:${BRAND_GOLD_LIGHT};">ASSET</span></p>
    <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:${BRAND_GOLD};">Daily Gold Update</p>
  </td></tr>

  <tr><td style="padding:32px 40px 8px;">
    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#F6F1E4;">${esc(title)}</h1>
  </td></tr>

  ${priceBlock}

  <tr><td style="padding:0 40px 8px;">
    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#D3C9AF;">${sanitizeToHtml(content)}</p>
  </td></tr>

  <tr><td style="padding:24px 40px 0;"></td></tr>
  ${imageBlock}
  ${marketBlock}
  ${ctaBlock}

  <tr><td style="padding:28px 40px;border-top:1px solid rgba(212,175,55,.18);text-align:center;">
    <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9C9384;">GBA Gold · sales@gbagold.my</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6E6A60;">
      You're receiving this because you subscribed to GBA Gold Daily Updates.
      <a href="${esc(unsubscribeUrl)}" style="color:${BRAND_GOLD_LIGHT};">Unsubscribe</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * A newsletter doc stores the admin's optional manual override as two
 * plain numbers — goldPrice (RM/g today) and priceChange (RM delta) — since
 * that's what the Create Newsletter form's two fields actually are. This
 * turns them into the {price, change, percent} shape renderNewsletterHtml
 * and getGoldPriceSnapshot() both use, or falls back to the live snapshot
 * when the admin left them blank.
 */
export async function resolveGoldPrice(newsletterLike, db) {
  const { goldPrice, priceChange } = newsletterLike;
  if (typeof goldPrice === "number" && goldPrice > 0) {
    const change = typeof priceChange === "number" ? priceChange : 0;
    const previous = goldPrice - change;
    const percent = previous > 0 ? (change / previous) * 100 : 0;
    return { price: goldPrice, change, percent, asOf: null, source: "manual" };
  }
  if (!db) return null;
  return getGoldPriceSnapshot(db);
}

function textFallback({ title, content, unsubscribeUrl }) {
  return `${title}\n\n${content}\n\n---\nGBA Gold · sales@gbagold.my\nUnsubscribe: ${unsubscribeUrl}`;
}

let resendSingleton = null;
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendSingleton) resendSingleton = new Resend(apiKey);
  return resendSingleton;
}

function fromHeader() {
  const email = process.env.NEWSLETTER_FROM_EMAIL || "sales@gbagold.my";
  const name = process.env.NEWSLETTER_FROM_NAME || "GBA Gold";
  return `${name} <${email}>`;
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://gbagold.my";
}

function unsubscribeUrlFor(token) {
  return `${siteUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends one rendered newsletter to a list of {email, token} recipients via
 * Resend's batch endpoint (up to 100 messages per call — the same call
 * Resend recommends for exactly this "one HTML body, many recipients, each
 * needs its own personalized field (the unsubscribe link)" shape, rather
 * than 1 API call per recipient). A short pause between chunks keeps this
 * under Resend's default rate limit regardless of list size, satisfying
 * "handle large subscriber lists safely" / "handle rate limits" without a
 * queue/worker system this project has no infrastructure for.
 */
async function sendToRecipients(resend, recipients, meta) {
  const CHUNK = 100;
  let successful = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const payload = chunk.map((r) => ({
      from: fromHeader(),
      to: [r.email],
      subject: meta.subject,
      html: renderNewsletterHtml({ ...meta, unsubscribeUrl: unsubscribeUrlFor(r.token) }),
      text: textFallback({ ...meta, unsubscribeUrl: unsubscribeUrlFor(r.token) }),
      headers: {
        // RFC 8058 one-click unsubscribe — Gmail/Yahoo's 2024 bulk-sender
        // rules effectively require this for reliable inbox placement, and
        // it gives recipients the native "Unsubscribe" button next to the
        // sender name instead of only the link in the footer.
        "List-Unsubscribe": `<${unsubscribeUrlFor(r.token)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }));

    try {
      const { data, error } = await resend.batch.send(payload);
      if (error) {
        failed += chunk.length;
        failures.push({ chunk: i / CHUNK, error: error.message || String(error) });
      } else {
        const results = Array.isArray(data) ? data : data?.data || [];
        chunk.forEach((r, idx) => {
          if (results[idx] && !results[idx].error) successful++;
          else failed++;
        });
      }
    } catch (err) {
      failed += chunk.length;
      failures.push({ chunk: i / CHUNK, error: err.message || String(err) });
    }

    if (i + CHUNK < recipients.length) await sleep(650);
  }

  return { successful, failed, failures };
}

/**
 * The guarded core send routine — shared by the "Send Now" admin action and
 * the cron's scheduled-send check, so there is exactly one code path that
 * ever actually dispatches a real newsletter (test sends are separate and
 * never touch this).
 *
 * A Firestore transaction reads the newsletter and only proceeds if its
 * status is "draft" or "scheduled", flipping it to "sending" as part of the
 * SAME transaction before any Resend call happens. That closes the race a
 * manual click and an overlapping cron run could otherwise hit — whichever
 * caller wins the transaction is the only one that ever sends.
 */
export async function sendNewsletterCore(newsletterId) {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin is not configured.");
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");

  const ref = db.collection("newsletters").doc(newsletterId);
  const newsletter = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new Error("Newsletter not found.");
    const data = doc.data();
    if (data.status !== "draft" && data.status !== "scheduled") {
      throw new Error(`Newsletter is already "${data.status}" — refusing to send it again.`);
    }
    tx.update(ref, { status: "sending" });
    return { id: doc.id, ...data };
  });

  try {
    const subsSnap = await db.collection("subscribers").where("status", "==", "active").get();
    const recipients = subsSnap.docs
      .map((d) => ({ email: d.data().email, token: d.data().unsubscribeToken }))
      .filter((r) => r.email && r.token);

    if (!recipients.length) {
      await ref.update({ status: "failed", recipientCount: 0, successfulCount: 0, failedCount: 0, sentAt: new Date(), error: "No active subscribers." });
      return { recipientCount: 0, successfulCount: 0, failedCount: 0 };
    }

    // Manual entry is an override, not the default — auto-fetch from the
    // live pricing data is preferred whenever the admin left the two price
    // fields blank (see section 11 of the request this implements).
    const goldPrice = await resolveGoldPrice(newsletter, db);

    const meta = {
      subject: newsletter.subject,
      title: newsletter.title,
      content: newsletter.content,
      marketUpdate: newsletter.marketUpdate,
      goldPrice,
      ctaText: newsletter.ctaText,
      ctaUrl: newsletter.ctaUrl,
      imageUrl: newsletter.imageUrl,
    };

    const { successful, failed, failures } = await sendToRecipients(resend, recipients, meta);

    // BulkWriter batches and auto-retries at whatever rate Firestore can
    // sustain — the admin-SDK-recommended way to touch "however many
    // subscriber docs there are" without hand-rolling chunking a second
    // time (sendToRecipients already chunks the EMAIL side; this is the
    // equivalent for the DATABASE side).
    const bulk = db.bulkWriter();
    const now = new Date();
    subsSnap.docs.forEach((d) => {
      if (d.data().email && d.data().unsubscribeToken) {
        bulk.update(d.ref, { lastEmailSentAt: now });
      }
    });
    await bulk.close();

    const finalStatus = successful > 0 ? "sent" : "failed";
    await ref.update({
      status: finalStatus,
      sentAt: now,
      recipientCount: recipients.length,
      successfulCount: successful,
      failedCount: failed,
      ...(failures.length ? { error: failures.map((f) => f.error).slice(0, 3).join("; ") } : {}),
    });

    // "Daily automated newsletter": an opt-in recurrence, not implicit
    // magic. The price is never copied forward — the clone is re-fetched
    // live at ITS OWN send time via the same getGoldPriceSnapshot() path,
    // so a recurring newsletter never mails yesterday's price.
    if (newsletter.recurrence === "daily" && finalStatus === "sent") {
      const nextRunAt = nextNineAmMalaysia();
      await db.collection("newsletters").add({
        subject: newsletter.subject,
        title: newsletter.title,
        content: newsletter.content,
        marketUpdate: newsletter.marketUpdate,
        ctaText: newsletter.ctaText || null,
        ctaUrl: newsletter.ctaUrl || null,
        imageUrl: newsletter.imageUrl || null,
        goldPrice: null, // always re-fetched live at send time, never carried forward
        priceChange: null,
        recurrence: "daily",
        status: "scheduled",
        scheduledAt: nextRunAt,
        createdAt: now,
        createdBy: newsletter.createdBy || "system (daily recurrence)",
        recipientCount: 0,
        successfulCount: 0,
        failedCount: 0,
      });
    }

    return { recipientCount: recipients.length, successfulCount: successful, failedCount: failed };
  } catch (err) {
    await ref.update({ status: "failed", error: err.message || String(err) });
    throw err;
  }
}

// The next 9:00 AM Asia/Kuala_Lumpur (UTC+8, no DST) strictly after "now" —
// used only to schedule a daily-recurrence newsletter's next run, computed
// server-side so it never depends on any browser's local clock/timezone.
export function nextNineAmMalaysia(from = new Date()) {
  const MY_OFFSET_MS = 8 * 60 * 60 * 1000;
  const myNow = new Date(from.getTime() + MY_OFFSET_MS);
  const next = new Date(Date.UTC(myNow.getUTCFullYear(), myNow.getUTCMonth(), myNow.getUTCDate(), 9, 0, 0));
  if (next.getTime() <= myNow.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return new Date(next.getTime() - MY_OFFSET_MS); // back to a real UTC instant
}

/** Test send — bypasses subscribers entirely, never touches newsletter status. */
export async function sendTestEmail(newsletterDraft, testEmail) {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  if (!isValidEmail(testEmail)) throw new Error("Invalid test email address.");

  const db = getAdminDb();
  const goldPrice = await resolveGoldPrice(newsletterDraft, db);

  const fakeToken = "test-preview-token";
  const html = renderNewsletterHtml({ ...newsletterDraft, goldPrice, unsubscribeUrl: unsubscribeUrlFor(fakeToken) });
  const { error } = await resend.emails.send({
    from: fromHeader(),
    to: [testEmail],
    subject: `[TEST] ${newsletterDraft.subject}`,
    html,
    text: textFallback({ ...newsletterDraft, unsubscribeUrl: unsubscribeUrlFor(fakeToken) }),
  });
  if (error) throw new Error(error.message || "Resend rejected the test email.");
}

/** Subscribe (or resubscribe) an email. Idempotent — safe to call twice. */
export async function subscribeEmail(email) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin is not configured.");

  const ref = db.collection("subscribers").doc(normalized);
  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const now = new Date();
    if (!doc.exists) {
      tx.set(ref, {
        email: normalized,
        status: "active",
        createdAt: now,
        updatedAt: now,
        unsubscribeToken: generateUnsubscribeToken(),
        lastEmailSentAt: null,
      });
      return { alreadyActive: false };
    }
    const data = doc.data();
    if (data.status === "active") return { alreadyActive: true };
    tx.update(ref, { status: "active", updatedAt: now });
    return { alreadyActive: false, resubscribed: true };
  });
  return { ok: true, ...result };
}

/** Unsubscribe by token — the only path a public request can flip status. */
export async function unsubscribeByToken(token) {
  if (!token || typeof token !== "string") return { ok: false, error: "Missing unsubscribe token." };
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin is not configured.");

  const snap = await db.collection("subscribers").where("unsubscribeToken", "==", token).limit(1).get();
  if (snap.empty) return { ok: false, error: "This unsubscribe link is invalid or has expired." };

  const doc = snap.docs[0];
  await doc.ref.update({ status: "unsubscribed", updatedAt: new Date() });
  return { ok: true, email: doc.data().email };
}
