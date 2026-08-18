// Shared between app/api/send-order-email and
// app/api/send-payment-confirmed-email — one set of formatting/escaping
// rules for every order-related email this project sends.
export const DELIVERY_LABELS = {
  self: "Self Pickup",
  standard: "Insured Courier",
  express: "Express Insured",
};

export function fmtRM(n) {
  return "RM " + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2 });
}

// order.customer/notes/address are free-text fields the customer typed at
// checkout — must be escaped before going into email HTML.
export function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}
