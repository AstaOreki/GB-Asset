// GB Asset Trading's company accounts for manual bank transfer. Single
// source of truth shared between the checkout confirmation screen
// (app/checkout/page.jsx) and the order confirmation email
// (app/api/send-order-email/route.js) so the account numbers can never
// drift between what a customer sees on-site and what lands in their inbox.
export const BANK_ACCOUNTS = [
  { bank: "AFFIN BANK", name: "GB ASSET TRADING", number: "106570025053" },
  { bank: "MAYBANK", name: "GB ASSET TRADING", number: "564294432684" },
];
