// The 5 states a bank-transfer order's payment can be in. Duplicated (not
// imported) into public/admin_dashboard.html's inline script, the same way
// STATIC_PRODUCTS/ADMIN_EMAILS are duplicated there — a static HTML file
// has no module system to share this from.
export const PAYMENT_STATUSES = {
  AWAITING_PAYMENT: "awaiting_payment",
  PROOF_SUBMITTED: "proof_submitted",
  UNDER_REVIEW: "under_review",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
};

export const PAYMENT_STATUS_LABELS = {
  awaiting_payment: "Awaiting Payment",
  proof_submitted: "Payment Proof Submitted",
  under_review: "Under Review",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

// Badge tone, not a CSS class name — each surface (checkout/order page vs.
// admin dashboard) maps this to its own existing badge styles rather than
// sharing markup.
export const PAYMENT_STATUS_TONE = {
  awaiting_payment: "warning",
  proof_submitted: "info",
  under_review: "purple",
  confirmed: "success",
  rejected: "danger",
};

export const RECEIPT_MIME_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
};

// 4MB, not 8 — confirmed live (system test, 2026-08-22) that anything over
// ~4.5MB never reaches this check at all: Vercel's Node.js Serverless
// Functions reject the request body at the platform level before the route
// handler runs, returning a bare 413 with no JSON body. An 8MB advertised
// limit was therefore unkeepable for anything above ~4.5MB. 4MB leaves
// headroom under that hard ceiling for multipart overhead and still covers
// a typical phone photo or scanned PDF.
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;
