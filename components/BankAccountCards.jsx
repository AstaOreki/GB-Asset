"use client";

import { useState } from "react";
import { BANK_ACCOUNTS } from "../lib/bankAccounts";

/**
 * The two GB Asset Trading bank account cards, with a working Copy button
 * per account number. Used by the bank-transfer payment page
 * (app/orders/[orderId]/payment) — previously lived inline in
 * app/checkout/page.jsx, moved here once checkout stopped showing account
 * details itself and started redirecting to the dedicated payment page.
 */
export default function BankAccountCards() {
  const [copiedAccount, setCopiedAccount] = useState("");

  function handleCopy(number) {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(number)
      .then(() => {
        setCopiedAccount(number);
        setTimeout(() => setCopiedAccount(""), 1800);
      })
      .catch(() => {});
  }

  return (
    <div className="bank-account-list">
      {BANK_ACCOUNTS.map((acc) => (
        <div className="bank-account-card" key={acc.number}>
          <div className="bank-account-bank">{acc.bank}</div>
          <div className="bank-account-name">{acc.name}</div>
          <div className="bank-account-number-row">
            <span className="bank-account-number">{acc.number}</span>
            <button type="button" className="bank-copy-btn" onClick={() => handleCopy(acc.number)}>
              {copiedAccount === acc.number ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
