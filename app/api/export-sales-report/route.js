import { renderToBuffer } from "@react-pdf/renderer";
import SalesReportDocument from "./SalesReportDocument";
import { verifyIdToken } from "../../../lib/firebaseAdmin";

// Sourced from the same env var the storefront's inline firebase-config
// script uses (see app/layout.jsx) so this can't drift from the actual
// admin list — this route had no authorization check at all before, so
// anyone with the URL could spend server compute rendering a PDF and get
// back a real, GBA-branded "Sales Report" for whatever numbers they typed.
function isAdminEmail(email) {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && list.includes(email.toLowerCase());
}

// Server-side PDF export for the admin dashboard's Sales Report section
// (public/admin_dashboard.html). The client already holds the exact
// filtered orders + summary totals it's displaying (both come from the
// same GBA.orders.listen() Firestore subscription the rest of the
// dashboard uses), so it POSTs that data here rather than this route
// re-querying Firestore itself — that guarantees the PDF always matches
// what the admin is looking at on screen, with no risk of the two
// falling out of sync from a slightly different filter re-implementation.
//
// Built with @react-pdf/renderer (not Puppeteer/headless Chrome) so this
// stays a normal, fast serverless function on Vercel's Hobby plan — no
// browser binary to bundle, no multi-second cold start.
export const runtime = "nodejs";

export async function POST(request) {
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
  if (!decoded || !isAdminEmail(decoded.email)) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { periodLabel, generatedAt, totals, orders } = body || {};
  if (!periodLabel || !totals || !Array.isArray(orders)) {
    return Response.json({ error: "Missing periodLabel, totals, or orders." }, { status: 400 });
  }

  try {
    const pdfBuffer = await renderToBuffer(
      SalesReportDocument({ periodLabel, generatedAt, totals, orders })
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Sales_Report_${dateStr}.pdf"`,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message || "Could not generate the report." }, { status: 500 });
  }
}
