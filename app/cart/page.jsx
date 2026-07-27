"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import { useGBA } from "../../hooks/useGBA";
import { useRevealOnScroll } from "../../hooks/useRevealOnScroll";
import { useButtonRipple } from "../../hooks/useButtonRipple";
import { useCartBadge } from "../../hooks/useCartBadge";
import "./cart.css";

// cart.html-specific delivery model (NOT checkout.html's fixed 3-tier map —
// the two pages intentionally disagree, per the approved migration plan).
const FREE_SHIP_THRESHOLD = 50000;
const COURIER_FEE = 150;

/**
 * "/cart" — ported from cart.html.
 *
 * Cart is never held as its own source of truth: every mutation re-reads
 * via GBA.cart.read() (mirrors the original's renderCart()), filtering out
 * lines whose product no longer exists or whose qty is <= 0. The minus
 * button never deletes a line — GBA.cart.changeQty clamps server-side to
 * [1,99] — removal only happens through the explicit remove button.
 */
export default function CartPage() {
  const gba = useGBA();
  const { refresh: refreshBadge } = useCartBadge();
  useRevealOnScroll();
  useButtonRipple();

  const [products, setProducts] = useState(null); // null until GBA.getProducts() resolves
  const [cart, setCart] = useState([]);
  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState("");

  const loadCart = useCallback(() => {
    if (!gba || !products) return;
    gba.cart.read().then((rawCart) => {
      const filtered = rawCart.filter((line) => line && products[line.id] && line.qty > 0);
      setCart(filtered);
    });
  }, [gba, products]);

  // Populate PRODUCTS once, on mount (once GBA is ready).
  useEffect(() => {
    if (!gba) return;
    gba.getProducts().then((p) => setProducts(p));
  }, [gba]);

  // Reload the cart once products are available, and after loadCart's
  // identity changes (i.e. whenever products/gba change).
  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Auth-aware re-render: mirrors cart.html's page-specific wireAuthNav(),
  // which re-runs renderCart() on every auth change so a guest cart that
  // gets migrated to a signed-in user on login becomes visible. Distinct
  // from StorefrontHeader's own useAuthAwareNav (that only drives the
  // login/logout button + its own badge copy).
  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.onAuthChange(() => {
      loadCart();
    });
    return unsubscribe;
  }, [gba, loadCart]);

  function handleChangeQty(id, delta) {
    if (!gba) return;
    gba.cart.changeQty(id, delta).then(() => {
      loadCart();
      refreshBadge();
    });
  }

  function handleRemove(id) {
    if (!gba) return;
    gba.cart.remove(id).then(() => {
      loadCart();
      refreshBadge();
    });
  }

  // FAKE / UI-theater, exactly as cart.html: no Firestore check, zero effect
  // on totals — just a static "will be verified at checkout" message.
  function handlePromoApply() {
    if (!promoInput.trim()) {
      setPromoMsg("Enter a code to apply.");
      return;
    }
    setPromoMsg("This code will be verified at checkout.");
  }

  const fmtRM = (n) => (gba ? gba.fmtRM(n) : "RM " + Math.round(n).toLocaleString("en-MY"));
  const subtotal = gba && products ? gba.cart.subtotal(cart, products) : 0;
  const delivery = subtotal >= FREE_SHIP_THRESHOLD ? 0 : COURIER_FEE;
  const total = subtotal + delivery;
  const isEmpty = cart.length === 0;

  return (
    <>
      <StorefrontHeader />

      <section className="page-hero">
        <div className="eyebrow">Your Selection</div>
        <h1>Shopping Cart</h1>
        <div className="breadcrumb">
          <Link href="/#top">Home</Link>
          <span className="sep">/</span>
          <span className="current">Shopping Cart</span>
        </div>
      </section>

      <section className="cart-section">
        <div className="wrap">
          <div className="cart-layout">
            <div>
              {products === null ? (
                <div className="panel cart-empty" id="cartEmpty">
                  <div className="cart-empty-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M3 4h2l2.2 12.2a2 2 0 002 1.8h8.6a2 2 0 002-1.7L21 8H6"></path>
                      <circle cx="9.5" cy="20" r="1.4"></circle>
                      <circle cx="17.5" cy="20" r="1.4"></circle>
                    </svg>
                  </div>
                  <h3>Loading your cart&hellip;</h3>
                </div>
              ) : isEmpty ? (
                <div className="panel cart-empty" id="cartEmpty">
                  <div className="cart-empty-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M3 4h2l2.2 12.2a2 2 0 002 1.8h8.6a2 2 0 002-1.7L21 8H6"></path>
                      <circle cx="9.5" cy="20" r="1.4"></circle>
                      <circle cx="17.5" cy="20" r="1.4"></circle>
                    </svg>
                  </div>
                  <h3>Your cart is empty</h3>
                  <p>You haven&apos;t added any bullion to your cart yet. Browse our collection to begin your investment.</p>
                  <Link className="btn btn-primary" data-ripple="" href="/#products">
                    Explore Gold
                  </Link>
                </div>
              ) : (
                <div className="panel" id="cartPanel">
                  <div className="cart-panel-head">
                    <span>Product</span>
                    <span>Details</span>
                    <span>Quantity</span>
                    <span>Total</span>
                    <span></span>
                  </div>
                  <div id="cartItems">
                    {cart.map((line) => {
                      const p = products[line.id];
                      if (!p) return null;
                      const lineTotal = p.price * line.qty;
                      return (
                        <div className="cart-item" data-id={line.id} key={line.id}>
                          <div className="cart-item-media">
                            <div className="gold-bar-container" style={{ width: `${p.w}px` }}>
                              <div className="glint-overlay"></div>
                              <img className="gold-bar-img" src={p.img} alt={p.name} />
                            </div>
                          </div>
                          <div className="cart-item-info">
                            <div className="tag">{p.tag}</div>
                            <h4>{p.name}</h4>
                            <div className="purity">Purity {p.purity}</div>
                            <div className="unit-price">
                              {fmtRM(p.price)} <span style={{ color: "var(--gray)" }}>/ unit</span>
                            </div>
                          </div>
                          <div className="cart-qty-cell">
                            <div className="qty-stepper">
                              <button
                                type="button"
                                className="qty-minus"
                                aria-label="Decrease quantity"
                                onClick={() => handleChangeQty(line.id, -1)}
                              >
                                {"−"}
                              </button>
                              <input type="text" inputMode="numeric" readOnly value={line.qty} aria-label="Quantity" />
                              <button
                                type="button"
                                className="qty-plus"
                                aria-label="Increase quantity"
                                onClick={() => handleChangeQty(line.id, 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="line-total">{fmtRM(lineTotal)}</div>
                          <button
                            type="button"
                            className="remove-item"
                            aria-label="Remove item"
                            onClick={() => handleRemove(line.id)}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M4 7h16"></path>
                              <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"></path>
                              <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"></path>
                              <path d="M10 11v6M14 11v6"></path>
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {products !== null && !isEmpty && (
              <div className="panel summary-card" id="summaryCard">
                <h3>Order Summary</h3>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span id="sumSubtotal">{fmtRM(subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Delivery &amp; Insurance</span>
                  <span id="sumDelivery">{delivery === 0 ? "Complimentary" : fmtRM(delivery)}</span>
                </div>
                <div className="summary-row muted">
                  <span>SST</span>
                  <span>Exempt &mdash; Investment Gold</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-total">
                  <span className="stlabel">Total</span>
                  <span className="stvalue" id="sumTotal">
                    {fmtRM(total)}
                  </span>
                </div>

                <div className="promo-row">
                  <input
                    id="promoInput"
                    placeholder="Promo code"
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                  />
                  <button id="promoBtn" type="button" onClick={handlePromoApply}>
                    Apply
                  </button>
                </div>
                <div className="promo-msg" id="promoMsg">
                  {promoMsg}
                </div>

                <Link
                  className="btn btn-primary"
                  data-ripple=""
                  href="/checkout"
                  style={{ width: "100%", justifyContent: "center", marginTop: "26px" }}
                >
                  Proceed to Checkout
                </Link>

                <div className="summary-note">
                  <svg viewBox="0 0 24 24">
                    <rect height="9" rx="1.5" width="14" x="5" y="11"></rect>
                    <path d="M8 11V7a4 4 0 018 0v4"></path>
                  </svg>
                  <span>All bullion is 999.9 fine gold, individually certified and insured in transit.</span>
                </div>
                <Link className="continue-link" href="/#products">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 12H5M11 6l-6 6 6 6"></path>
                  </svg>
                  Continue Shopping
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="strip">
        <div className="wrap">
          <div className="trust-strip-inner reveal">
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l7 3v6c0 5-3.3 7.6-7 9-3.7-1.4-7-4-7-9V6l7-3Z"></path>
                  <path d="M9 12.2l2.1 2.1L15.3 10"></path>
                </svg>
              </div>
              <div>
                <b>100% Authentic</b>
                <span>Certified &amp; genuine</span>
              </div>
            </div>
            <span className="ts-divider"></span>
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M4 9l3-4h10l3 4-8 11-8-11z" strokeLinejoin="round"></path>
                  <path d="M4 9h16"></path>
                  <path d="M9 5l3 15 3-15"></path>
                </svg>
              </div>
              <div>
                <b>999.9 Fine Gold</b>
                <span>LBMA-aligned sourcing</span>
              </div>
            </div>
            <span className="ts-divider"></span>
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <rect height="9" rx="1.5" width="14" x="5" y="11"></rect>
                  <path d="M8 11V7a4 4 0 018 0v4"></path>
                </svg>
              </div>
              <div>
                <b>Secure Transaction</b>
                <span>Safe &amp; reliable</span>
              </div>
            </div>
            <span className="ts-divider"></span>
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M3 7h11v9H3z"></path>
                  <path d="M14 11h4l3 3v2h-7z"></path>
                  <circle cx="7.5" cy="18" r="1.6"></circle>
                  <circle cx="17.5" cy="18" r="1.6"></circle>
                </svg>
              </div>
              <div>
                <b>Nationwide Delivery</b>
                <span>Insured &amp; secure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FullFooter />
    </>
  );
}
