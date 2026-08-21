import { verifyIdToken } from "./firebaseAdmin";

// Same admin check as app/api/newsletter/send/route.js and
// app/api/export-sales-report/route.js — sourced from the same env var the
// storefront's inline firebase-config script uses, so it can never drift
// from the real admin list. Shared here (rather than duplicated again)
// since app/api/orders/* adds several routes that all need it.
function adminEmailList() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  return Boolean(email) && adminEmailList().includes(email.toLowerCase());
}

// The real-cased addresses, for sending mail to (as opposed to the
// lowercased list above, which is only for case-insensitive comparison).
export function getAdminEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function bearerToken(request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

// Returns the decoded { uid, email } for any signed-in user, or null.
export async function getRequestUser(request) {
  const idToken = bearerToken(request);
  if (!idToken) return null;
  try {
    return await verifyIdToken(idToken);
  } catch {
    return null;
  }
}

// Returns the decoded admin, or null if not signed in / not an admin.
export async function getRequestAdmin(request) {
  const decoded = await getRequestUser(request);
  if (!decoded || !isAdminEmail(decoded.email)) return null;
  return decoded;
}
