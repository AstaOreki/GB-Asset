import nodemailer from "nodemailer";

const DELIVERY_LABELS = {
  self: "Self Pickup",
  standard: "Insured Courier",
  express: "Express Insured",
};

function fmtRM(n) {
  return "RM " + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2 });
}

// order.customer/notes/address are free-text fields the customer typed at
// checkout — must be escaped before going into the email HTML, same as the
// admin dashboard already does for order data rendered in the browser.
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function renderOrderEmailHtml(order) {
  const itemsRows = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e2e1;">${esc(item.name)} × ${Number(item.qty)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e2e1;text-align:right;">${fmtRM(item.lineTotal)}</td>
        </tr>`
    )
    .join("");

  const addressBlock =
    order.deliveryMethod === "self"
      ? ""
      : `<p style="margin:4px 0;color:#555;">${[order.address?.line, order.address?.city, order.address?.state, order.address?.postcode]
          .filter(Boolean)
          .map(esc)
          .join(", ")}</p>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#a67c27;">Thank you for your order, ${esc(order.customer)}!</h2>
    <p>Your order <strong>#${esc(order.orderId)}</strong> has been received and is being processed.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      ${itemsRows}
      <tr><td style="padding:10px 0;">Subtotal</td><td style="padding:10px 0;text-align:right;">${fmtRM(order.subtotal)}</td></tr>
      <tr><td style="padding:10px 0;">Delivery (${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)})</td><td style="padding:10px 0;text-align:right;">${fmtRM(order.deliveryFee)}</td></tr>
      <tr><td style="padding:10px 0;font-weight:bold;border-top:2px solid #1a1a1a;">Total</td><td style="padding:10px 0;text-align:right;font-weight:bold;border-top:2px solid #1a1a1a;">${fmtRM(order.amount)}</td></tr>
    </table>
    <p style="margin:4px 0;"><strong>Delivery method:</strong> ${esc(DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod)}</p>
    ${addressBlock}
    <p style="margin:4px 0;"><strong>Payment method:</strong> ${esc(order.paymentMethod)}</p>
    ${order.notes ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${esc(order.notes)}</p>` : ""}
    <p style="margin-top:24px;color:#777;font-size:13px;">GBA Asset — this is an automated confirmation, please keep it for your records.</p>
  </div>`;
}

export async function POST(request) {
  // Sends via the business's own Google Workspace mailbox over SMTP,
  // rather than a transactional-email provider (Resend). Needs 2-Step
  // Verification enabled on the sending account and an App Password
  // generated for it — see README notes at the bottom of this file.
  const workspaceEmail = process.env.GOOGLE_WORKSPACE_EMAIL;
  const workspaceAppPassword = process.env.GOOGLE_WORKSPACE_APP_PASSWORD;
  if (!workspaceEmail || !workspaceAppPassword) {
    return Response.json({ error: "Email service not configured." }, { status: 501 });
  }

  let order;
  try {
    order = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!order || !order.email || !order.orderId) {
    return Response.json({ error: "Missing order details." }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: workspaceEmail, pass: workspaceAppPassword },
    });
    await transporter.sendMail({
      from: `GBA Asset <${workspaceEmail}>`,
      to: order.email,
      subject: `Order Confirmation — #${order.orderId}`,
      html: renderOrderEmailHtml(order),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "Failed to send email." }, { status: 500 });
  }
}

// --- What's needed for this route to actually send ---
// 1. GOOGLE_WORKSPACE_EMAIL — the sending mailbox, e.g. orders@gbagold.my
// 2. GOOGLE_WORKSPACE_APP_PASSWORD — a 16-character App Password for that
//    account (Google Account -> Security -> 2-Step Verification -> App
//    passwords). Requires 2-Step Verification to be turned on for that
//    account first. If a Workspace admin has disabled App Passwords
//    org-wide, OAuth2 is required instead — a bigger setup (Google Cloud
//    project + OAuth client + refresh token).
// Both values get added as Vercel environment variables, same as every
// other secret this project uses.
