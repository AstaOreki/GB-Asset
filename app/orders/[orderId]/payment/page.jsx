"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import StorefrontHeader from "../../../../components/StorefrontHeader";
import FullFooter from "../../../../components/FullFooter";
import BankAccountCards from "../../../../components/BankAccountCards";
import { useGBA } from "../../../../hooks/useGBA";
import { useAuthAwareNav } from "../../../../hooks/useAuthAwareNav";
import { useButtonRipple } from "../../../../hooks/useButtonRipple";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONE } from "../../../../lib/paymentStatus";
import "./payment.css";

const UPLOADABLE_STATUSES = ["awaiting_payment", "rejected"];
const SUBMITTED_STATUSES = ["proof_submitted", "under_review"];

function fmtRMFallback(gba, n) {
  return gba ? gba.fmtRM(n) : `RM ${Number(n || 0).toFixed(2)}`;
}

export default function BankTransferPaymentPage({ params }) {
  const { orderId } = use(params);
  const gba = useGBA();
  const { user, isAuthed, authReady } = useAuthAwareNav();
  useButtonRipple();

  const [order, setOrder] = useState(undefined); // undefined = loading, null = not found/denied
  const [copiedRef, setCopiedRef] = useState(false);

  const [file, setFile] = useState(null);
  const [bankName, setBankName] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [amountTransferred, setAmountTransferred] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!authReady || isAuthed) return;
    window.location.href = `/login?redirect=orders/${orderId}/payment`;
  }, [authReady, isAuthed, orderId]);

  useEffect(() => {
    if (!gba || !orderId) return;
    const unsubscribe = gba.orders.listenOne(orderId, (data) => setOrder(data));
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba, orderId]);

  // If an admin rejects this receipt while the customer still has the page
  // open, drop the stale "submitted successfully" panel from their earlier
  // upload — otherwise it never clears itself, and the re-upload form the
  // rejection banner is telling them to use would stay hidden underneath it.
  useEffect(() => {
    if (order && order.paymentStatus === "rejected") setUploadSuccess(false);
  }, [order && order.paymentStatus]);

  function handleCopyRef() {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(orderId)
      .then(() => {
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 1800);
      })
      .catch(() => {});
  }

  function handleFileChange(e) {
    setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null);
    setUploadError("");
  }

  function handleUpload(e) {
    e.preventDefault();
    if (!gba || !file || uploading) return;

    const currentUser = gba.getCurrentUser();
    if (!currentUser) {
      setUploadError("Your session has expired — please sign in again.");
      return;
    }

    setUploading(true);
    setUploadPct(0);
    setUploadError("");
    setUploadSuccess(false);

    currentUser.getIdToken().then((idToken) => {
      const form = new FormData();
      form.append("orderId", orderId);
      form.append("file", file);
      if (bankName.trim()) form.append("bankName", bankName.trim());
      if (txnRef.trim()) form.append("transactionReference", txnRef.trim());
      if (amountTransferred !== "") form.append("amountTransferred", amountTransferred);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/orders/upload-receipt");
      xhr.setRequestHeader("Authorization", `Bearer ${idToken}`);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) setUploadPct(Math.round((evt.loaded / evt.total) * 100));
      };
      xhr.onload = () => {
        setUploading(false);
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // ignore — handled by the status check below
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          setUploadSuccess(true);
          setFile(null);
          setBankName("");
          setTxnRef("");
          setAmountTransferred("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          setUploadError(data.error || "Could not submit your receipt — please try again.");
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setUploadError("Could not submit your receipt — please check your connection and try again.");
      };
      xhr.send(form);
    });
  }

  const status = order && order.paymentStatus;
  const statusLabel = status ? PAYMENT_STATUS_LABELS[status] || status : "";
  const statusTone = status ? PAYMENT_STATUS_TONE[status] || "warning" : "warning";

  return (
    <>
      <StorefrontHeader />

      <section className="page-hero">
        <div className="eyebrow">Bank Transfer</div>
        <h1>Complete Your Payment</h1>
        <div className="breadcrumb">
          <Link href="/#top">Home</Link>
          <span className="sep">/</span>
          <span className="current">Payment</span>
        </div>
      </section>

      <section className="payment-page-section">
        <div className="wrap payment-page-wrap">
          {order === undefined && <div className="panel payment-loading">Loading your order…</div>}

          {order === null && (
            <div className="panel payment-loading">
              We couldn't find this order, or you don't have permission to view it.
              <br />
              <Link className="btn btn-primary" data-ripple="" href="/#top" style={{ marginTop: 24 }}>
                Return to Home
              </Link>
            </div>
          )}

          {order && order.paymentMethod !== "bank" && (
            <div className="panel payment-loading">
              This order doesn't use bank transfer.
              <br />
              <Link className="btn btn-primary" data-ripple="" href="/#top" style={{ marginTop: 24 }}>
                Return to Home
              </Link>
            </div>
          )}

          {order && order.paymentMethod === "bank" && (
            <div className="payment-page-grid">
              <div className="panel payment-order-info">
                <h3>Order Information</h3>
                <div className="payment-info-row">
                  <span>Order Number</span>
                  <b>{orderId}</b>
                </div>
                <div className="payment-info-row">
                  <span>Customer Name</span>
                  <b>{order.customer}</b>
                </div>
                <div className="payment-info-row">
                  <span>Total Amount</span>
                  <b>{fmtRMFallback(gba, order.amount)}</b>
                </div>
                <div className="payment-info-row">
                  <span>Payment Status</span>
                  <span className={`payment-badge is-${statusTone}`}>{statusLabel}</span>
                </div>
              </div>

              {status === "rejected" && order.rejectionReason && (
                <div className="panel payment-rejected-banner">
                  <b>Your payment proof was rejected.</b>
                  <p>Reason: {order.rejectionReason}</p>
                  <p>Please upload a new valid payment receipt below.</p>
                </div>
              )}

              {status === "confirmed" && (
                <div className="panel payment-confirmed-banner">
                  <b>Payment Confirmed</b>
                  <p>Your payment has been verified and your order is now confirmed. We'll be in touch to arrange the next steps.</p>
                </div>
              )}

              <div className="panel bank-transfer-panel">
                <h4 className="bank-transfer-details-heading" style={{ marginTop: 0 }}>
                  Bank Transfer Details
                </h4>
                <BankAccountCards />
              </div>

              <div className="panel payment-reference-panel">
                <span className="payment-reference-label">Payment Reference</span>
                <div className="payment-reference-row">
                  <span className="payment-reference-value">{orderId}</span>
                  <button type="button" className="bank-copy-btn" onClick={handleCopyRef}>
                    {copiedRef ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <p className="bank-transfer-note">Please use your Order Number as the payment reference when making the bank transfer.</p>
              </div>

              {uploadSuccess && (
                // Deliberately NOT gated on UPLOADABLE_STATUSES — the
                // realtime order listener flips `status` to
                // "proof_submitted" right around when this upload
                // completes (often before the user can even read this),
                // and that status is what hides the form below. Without
                // its own unconditional block, this confirmation would
                // vanish the instant the order updates instead of staying
                // up as the actual "your upload worked" message.
                <div className="panel payment-upload-panel">
                  <h3>Upload Payment Receipt</h3>
                  <div className="status-note">
                    Your payment receipt has been submitted successfully. Our admin will verify your payment before
                    confirming your order.
                  </div>
                </div>
              )}

              {!uploadSuccess && UPLOADABLE_STATUSES.includes(status) && (
                <form className="panel payment-upload-panel" onSubmit={handleUpload}>
                  <h3>Upload Payment Receipt</h3>

                  <div className="field small">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      required
                    />
                  </div>
                  <p className="payment-upload-hint">JPG, JPEG, PNG, or PDF — up to 8MB.</p>

                  <div className="field-row" style={{ marginTop: 22 }}>
                    <div className="field">
                      <input placeholder=" " type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                      <label>Bank Used (optional)</label>
                    </div>
                    <div className="field">
                      <input placeholder=" " type="text" value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
                      <label>Transaction Reference (optional)</label>
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 26 }}>
                    <input
                      placeholder=" "
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountTransferred}
                      onChange={(e) => setAmountTransferred(e.target.value)}
                    />
                    <label>Amount Transferred (optional)</label>
                  </div>

                  {uploading && (
                    <div className="payment-upload-progress">
                      <div className="payment-upload-progress-bar" style={{ width: `${uploadPct}%` }} />
                    </div>
                  )}

                  <button className="submit-btn" data-ripple="" type="submit" disabled={!file || uploading}>
                    {uploading ? `Uploading… ${uploadPct}%` : "Submit Payment Proof"}
                  </button>

                  {uploadError && <div className="status-note status-note-error" style={{ marginTop: 14 }}>{uploadError}</div>}
                </form>
              )}

              {(SUBMITTED_STATUSES.includes(status) || status === "confirmed") && order.receiptFileName && order.receiptUrl && (
                <div className="panel payment-receipt-view">
                  <h3>Your Submitted Receipt</h3>
                  <p className="payment-upload-hint">{order.receiptFileName}</p>
                  <a
                    className="btn btn-primary"
                    data-ripple=""
                    href={order.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View My Receipt
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <FullFooter />
    </>
  );
}
