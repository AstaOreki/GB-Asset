import { verifyIdToken, getAdminDb } from "../../../../lib/firebaseAdmin";
import { renderNewsletterHtml, resolveGoldPrice } from "../../../../lib/newsletter";

function isAdminEmail(email) {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && list.includes(email.toLowerCase());
}

/**
 * Admin-only. Renders the EXACT template sendNewsletterCore()/sendTestEmail()
 * use, from whatever draft fields are currently in the form (not
 * necessarily saved yet) — so "Preview" always matches what a real send
 * would produce. Returns HTML, not a redirect/page, so the dashboard can
 * drop it straight into an <iframe srcDoc>.
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

  let draft;
  try {
    draft = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const goldPrice = await resolveGoldPrice(draft || {}, db);
    const html = renderNewsletterHtml({
      title: draft.title || "(Untitled)",
      content: draft.content || "",
      marketUpdate: draft.marketUpdate || "",
      goldPrice,
      ctaText: draft.ctaText || "",
      ctaUrl: draft.ctaUrl || "",
      imageUrl: draft.imageUrl || "",
      unsubscribeUrl: "#preview-unsubscribe-link",
    });
    return Response.json({ ok: true, html });
  } catch (err) {
    return Response.json({ error: err.message || "Could not render the preview." }, { status: 500 });
  }
}
