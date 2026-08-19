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

export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo or scanned PDF, small enough to reject abuse.
