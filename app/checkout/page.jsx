"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import { useGBA } from "../../hooks/useGBA";
import { useAuthAwareNav } from "../../hooks/useAuthAwareNav";
import { useRevealOnScroll } from "../../hooks/useRevealOnScroll";
import { useButtonRipple } from "../../hooks/useButtonRipple";
import { useCartBadge } from "../../hooks/useCartBadge";
import "./checkout.css";

// Fixed 3-tier delivery-fee map — no free-shipping threshold on checkout
// (that's cart.html's different, intentionally-inconsistent model; see the
// migration plan's "known pre-existing quirks" section).
const DELIVERY_FEES = { self: 0, standard: 150, express: 280 };

export default function CheckoutPage() {
  const gba = useGBA();
  const { user, isAuthed, authReady } = useAuthAwareNav();
  const { refresh: refreshCartBadge } = useCartBadge();

  useRevealOnScroll();
  useButtonRipple();

  // 'details' -> checkout form + order summary; 'confirmed' -> success panel.
  // Not a real multi-step wizard — every field renders at once inside one
  // form; this is the only real state transition the original page has.
  const [step, setStep] = useState("details");

  const [products, setProducts] = useState(null);
  const [currentCart, setCurrentCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState("self");
  const [paymentError, setPaymentError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState("");

  // Shipping address always comes from the profile's saved addresses now —
  // no more retyping it here. If the user has none yet, the same
  // "+ Add New Address" form used on /profile appears inline.
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrName, setAddrName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");
  const [addrSaving, setAddrSaving] = useState(false);

  const formRef = useRef(null);
  const paymentBlockRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const notesRef = useRef(null);

  // Load products, then the cart lines that reference them — same pattern
  // as cart.html: GBA.cart.read() + GBA.getProducts().
  useEffect(() => {
    if (!gba) return;
    gba.getProducts().then((prods) => {
      setProducts(prods);
    });
  }, [gba]);

  const loadCart = useCallback(() => {
    if (!gba || !products) return;
    gba.cart.read().then((rawCart) => {
      const filtered = rawCart.filter((l) => l && products[l.id] && l.qty > 0);
      setCurrentCart(filtered);
      setCartLoaded(true);
    });
  }, [gba, products]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Re-read on auth changes too (mirrors cart.html/cart/page.jsx): a guest
  // cart that gets merged into a freshly-registered/logged-in account
  // needs to be picked up here even if this effect already ran once before
  // auth resolved.
  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.onAuthChange(() => {
      loadCart();
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba, loadCart]);

  // Load saved addresses for the signed-in user and default to picking the first one.
  const loadAddresses = useCallback(() => {
    if (!gba || !user) return;
    gba.profile.addresses.list().then((list) => {
      setSavedAddresses(list);
      setSelectedAddressId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0]?.id || ""));
    });
  }, [gba, user]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  function resetAddrForm() {
    setAddrLabel("");
    setAddrName("");
    setAddrPhone("");
    setAddrLine("");
    setAddrCity("");
    setAddrState("");
    setAddrPostcode("");
  }

  function handleAddAddress() {
    if (!gba || !addrLabel.trim() || !addrLine.trim()) return;
    setAddrSaving(true);
    gba.profile.addresses
      .add({
        label: addrLabel.trim(),
        name: addrName.trim(),
        phone: addrPhone.trim(),
        line: addrLine.trim(),
        city: addrCity.trim(),
        state: addrState,
        postcode: addrPostcode.trim(),
      })
      .then((entry) => {
        setAddrSaving(false);
        setShowAddForm(false);
        resetAddrForm();
        setSavedAddresses((prev) => [...prev, entry]);
        setSelectedAddressId(entry.id);
      })
      .catch(() => setAddrSaving(false));
  }

  // Auth-aware prefill: if a signed-in user's name/email fields are empty,
  // fill them from their account (matches original wireAuthNav behavior).
  useEffect(() => {
    if (!user) return;
    if (nameRef.current && !nameRef.current.value && user.displayName) {
      nameRef.current.value = user.displayName;
    }
    if (emailRef.current && !emailRef.current.value && user.email) {
      emailRef.current.value = user.email;
    }
  }, [user]);

  // Placing an order requires an account — wait until the real auth state
  // is known (authReady) before redirecting, so a signed-in user whose
  // session just hasn't resolved yet isn't wrongly bounced to /login.
  useEffect(() => {
    if (!authReady || isAuthed) return;
    window.location.href = "/login?redirect=checkout";
  }, [authReady, isAuthed]);

  const subtotal = products ? gba?.cart.subtotal(currentCart, products) ?? 0 : 0;
  const deliveryFee = DELIVERY_FEES[deliveryMethod];
  const total = subtotal + deliveryFee;

  function handleSubmit(e) {
    e.preventDefault();
    if (!gba || !products) return;

    const form = formRef.current;
    const paymentChecked = form.querySelector('input[name="payment"]:checked');
    if (!paymentChecked) {
      setPaymentError(true);
      const pmBlock = paymentBlockRef.current;
      if (pmBlock) {
        pmBlock.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (!currentCart.length) return;

    const name = nameRef.current.value.trim();
    const phone = phoneRef.current.value.trim();
    const email = emailRef.current.value.trim();
    if (!name || !phone || !email) {
      if (form.reportValidity) form.reportValidity();
      return;
    }

    setIsSubmitting(true);

    const delivery = deliveryMethod;
    const fee = DELIVERY_FEES[delivery];
    const lineSubtotal = gba.cart.subtotal(currentCart, products);
    const items = currentCart.map((line) => {
      const p = products[line.id];
      return { id: line.id, name: p.name, qty: line.qty, price: p.price, lineTotal: p.price * line.qty };
    });

    const selectedSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
    const address = selectedSavedAddress
      ? {
          line: selectedSavedAddress.line || "",
          city: selectedSavedAddress.city || "",
          state: selectedSavedAddress.state || "",
          postcode: selectedSavedAddress.postcode || "",
        }
      : { line: "", city: "", state: "", postcode: "" };

    const orderData = {
      customer: name,
      phone: phone,
      email: email,
      deliveryMethod: delivery,
      deliveryFee: fee,
      address: address,
      paymentMethod: paymentChecked.value,
      notes: notesRef.current.value.trim(),
      items: items,
      product: items.map((i) => i.name).join(", "),
      amount: lineSubtotal + fee,
      subtotal: lineSubtotal,
    };

    gba.orders
      .create(orderData)
      .then((newOrderId) => {
        setOrderId(newOrderId);
        fetch("/api/send-order-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...orderData, orderId: newOrderId }),
        }).catch(() => {}); // fire-and-forget — an email hiccup must never block order success
        return gba.cart.clear();
      })
      .then(() => {
        refreshCartBadge();
        setStep("confirmed");
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(() => {
        setIsSubmitting(false);
        window.alert("We could not place your order — please check your connection and try again.");
      });
  }

  const isEmpty = cartLoaded && currentCart.length === 0;

  return (
    <>
      <StorefrontHeader />

      <section className="page-hero">
        <div className="eyebrow">Final Step</div>
        <h1>Secure Checkout</h1>
        <div className="breadcrumb">
          <Link href="/#top">Home</Link>
          <span className="sep">/</span>
          <Link href="/cart">Cart</Link>
          <span className="sep">/</span>
          <span className="current">Checkout</span>
        </div>
        <div className="checkout-steps">
          <div className="cstep done">
            <div className="cstep-num">1</div>
            <span className="label">Cart</span>
          </div>
          <div className="cstep-line"></div>
          <div className={`cstep ${step === "details" ? "active" : "done"}`} id="stepDetails">
            <div className="cstep-num">2</div>
            <span className="label">Details &amp; Payment</span>
          </div>
          <div className="cstep-line"></div>
          <div className={`cstep ${step === "confirmed" ? "active" : ""}`} id="stepConfirm">
            <div className="cstep-num">3</div>
            <span className="label">Confirmation</span>
          </div>
        </div>
      </section>

      <section className="checkout-section">
        <div className="wrap">
          {isEmpty && step === "details" && (
            <div className="panel cart-empty" id="checkoutEmpty">
              <div className="cart-empty-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 4h2l2.2 12.2a2 2 0 002 1.8h8.6a2 2 0 002-1.7L21 8H6"></path>
                  <circle cx="9.5" cy="20" r="1.4"></circle>
                  <circle cx="17.5" cy="20" r="1.4"></circle>
                </svg>
              </div>
              <h3>Your cart is empty</h3>
              <p>Add gold bullion to your cart before proceeding to checkout.</p>
              <Link className="btn btn-primary" data-ripple="" href="/#products">
                Explore Gold
              </Link>
            </div>
          )}

          {!isEmpty && step === "details" && (
            <div id="checkoutMain">
              <div className="checkout-layout" id="checkoutFormWrap">
                <form className="panel checkout-form" id="checkoutForm" ref={formRef} onSubmit={handleSubmit}>
                  <div className="checkout-block">
                    <h3>
                      <span className="num">1</span>Contact Information
                    </h3>
                    <div className="field-row">
                      <div className="field">
                        <input id="coName" ref={nameRef} placeholder=" " required type="text" />
                        <label>Full Name *</label>
                      </div>
                      <div className="field">
                        <input id="coPhone" ref={phoneRef} placeholder=" " required type="tel" />
                        <label>Phone Number *</label>
                      </div>
                    </div>
                    <div className="field">
                      <input id="coEmail" ref={emailRef} placeholder=" " required type="email" />
                      <label>Email Address *</label>
                    </div>
                  </div>

                  <div className="checkout-block">
                    <h3>
                      <span className="num">2</span>Delivery Method
                    </h3>
                    <div className="option-cards">
                      <label className="option-card">
                        <input
                          checked={deliveryMethod === "self"}
                          name="delivery"
                          type="radio"
                          value="self"
                          onChange={() => setDeliveryMethod("self")}
                        />
                        <b>Self Pickup</b>
                        <span>Collect in person at our Penang showroom.</span>
                        <div className="oc-price">Complimentary</div>
                      </label>
                      <label className="option-card">
                        <input
                          checked={deliveryMethod === "standard"}
                          name="delivery"
                          type="radio"
                          value="standard"
                          onChange={() => setDeliveryMethod("standard")}
                        />
                        <b>Insured Courier</b>
                        <span>Nationwide delivery, 3–5 working days.</span>
                        <div className="oc-price">RM 150</div>
                      </label>
                      <label className="option-card">
                        <input
                          checked={deliveryMethod === "express"}
                          name="delivery"
                          type="radio"
                          value="express"
                          onChange={() => setDeliveryMethod("express")}
                        />
                        <b>Express Insured</b>
                        <span>Priority delivery, 1–2 working days.</span>
                        <div className="oc-price">RM 280</div>
                      </label>
                    </div>
                  </div>

                  <div className="checkout-block" id="shippingBlock">
                    <h3>
                      <span className="num">3</span>Shipping Address
                    </h3>

                    {savedAddresses.length > 0 && (
                      <div className="option-cards">
                        {savedAddresses.map((a) => (
                          <label className="option-card" key={a.id}>
                            <input
                              checked={selectedAddressId === a.id}
                              name="savedAddress"
                              type="radio"
                              value={a.id}
                              onChange={() => setSelectedAddressId(a.id)}
                            />
                            <b>{a.label}</b>
                            <span>
                              {a.line}
                              {a.city ? `, ${a.city}` : ""}
                              {a.state ? `, ${a.state}` : ""} {a.postcode}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {savedAddresses.length === 0 && !showAddForm && (
                      <p className="profile-note">No saved addresses yet.</p>
                    )}

                    {showAddForm ? (
                      // A plain div, not <form> — this already sits inside the
                      // page's single #checkoutForm, and HTML forms can't nest
                      // (a nested submit button would trigger the outer
                      // checkout form's submit instead of this one).
                      <div className="address-form">
                        <div className="field-row">
                          <div className="field">
                            <input
                              placeholder=" "
                              type="text"
                              value={addrLabel}
                              onChange={(e) => setAddrLabel(e.target.value)}
                            />
                            <label>Label (e.g. Home, Office)</label>
                          </div>
                          <div className="field">
                            <input placeholder=" " type="text" value={addrName} onChange={(e) => setAddrName(e.target.value)} />
                            <label>Recipient Name</label>
                          </div>
                        </div>
                        <div className="field" style={{ marginTop: 26 }}>
                          <input placeholder=" " type="tel" value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} />
                          <label>Phone Number</label>
                        </div>
                        <div className="field" style={{ marginTop: 26 }}>
                          <input
                            placeholder=" "
                            type="text"
                            value={addrLine}
                            onChange={(e) => setAddrLine(e.target.value)}
                          />
                          <label>Address Line</label>
                        </div>
                        <div className="field-row three" style={{ marginTop: 26 }}>
                          <div className="field">
                            <input placeholder=" " type="text" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                            <label>City</label>
                          </div>
                          <div className="field">
                            <select
                              data-empty={addrState === "" ? "true" : "false"}
                              value={addrState}
                              onChange={(e) => setAddrState(e.target.value)}
                            >
                              <option value=""></option>
                              <option>Johor</option>
                              <option>Kedah</option>
                              <option>Kelantan</option>
                              <option>Kuala Lumpur</option>
                              <option>Labuan</option>
                              <option>Malacca</option>
                              <option>Negeri Sembilan</option>
                              <option>Pahang</option>
                              <option>Penang</option>
                              <option>Perak</option>
                              <option>Perlis</option>
                              <option>Putrajaya</option>
                              <option>Sabah</option>
                              <option>Sarawak</option>
                              <option>Selangor</option>
                              <option>Terengganu</option>
                              <option>Other</option>
                            </select>
                            <label>State</label>
                          </div>
                          <div className="field">
                            <input
                              placeholder=" "
                              type="text"
                              value={addrPostcode}
                              onChange={(e) => setAddrPostcode(e.target.value)}
                            />
                            <label>Postcode</label>
                          </div>
                        </div>
                        <div className="address-form-actions">
                          <button
                            className="submit-btn small"
                            data-ripple=""
                            type="button"
                            disabled={addrSaving}
                            onClick={handleAddAddress}
                          >
                            {addrSaving ? "Saving…" : "Save Address"}
                          </button>
                          <button
                            className="address-cancel"
                            type="button"
                            onClick={() => {
                              setShowAddForm(false);
                              resetAddrForm();
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="add-address-btn" type="button" onClick={() => setShowAddForm(true)}>
                        + Add New Address
                      </button>
                    )}
                  </div>

                  <div
                    className="checkout-block"
                    id="paymentBlock"
                    ref={paymentBlockRef}
                    style={
                      paymentError
                        ? { boxShadow: "0 0 0 1px rgba(176,24,41,.6)", borderRadius: "4px" }
                        : undefined
                    }
                  >
                    <h3>
                      <span className="num">4</span>Payment Method
                    </h3>
                    <div className="option-cards">
                      <label className="option-card">
                        <input name="payment" type="radio" value="bank" />
                        <b>Bank Transfer</b>
                        <span>Direct transfer, order held for verification.</span>
                      </label>
                      <label className="option-card">
                        <input name="payment" type="radio" value="card" />
                        <b>Credit / Debit Card</b>
                        <span>Visa, Mastercard, secured checkout.</span>
                      </label>
                      <label className="option-card">
                        <input name="payment" type="radio" value="cash" />
                        <b>Cash on Pickup</b>
                        <span>Pay in-store upon collection.</span>
                      </label>
                    </div>
                  </div>

                  <div className="checkout-block">
                    <h3>
                      <span className="num">5</span>Order Notes{" "}
                      <span
                        style={{
                          textTransform: "none",
                          letterSpacing: 0,
                          color: "var(--gray-soft)",
                          fontFamily: "var(--body)",
                          fontWeight: 300,
                        }}
                      >
                        (optional)
                      </span>
                    </h3>
                    <div className="field small">
                      <textarea id="coNotes" ref={notesRef} placeholder=" "></textarea>
                      <label>Special instructions</label>
                    </div>
                  </div>

                  <button className="submit-btn" data-ripple="" type="submit" disabled={isSubmitting || !products || !cartLoaded}>
                    {isSubmitting ? "Placing Order…" : !products || !cartLoaded ? "Loading…" : "Place Order"}
                  </button>
                  <div className="submit-sub">By placing your order you agree to our Terms &amp; Conditions.</div>
                </form>

                <div className="panel summary-card" id="checkoutSummaryCard">
                  <h3>Order Review</h3>
                  <div className="order-review" id="orderReview">
                    {currentCart.map((line) => {
                      const p = products ? products[line.id] : null;
                      if (!p) return null;
                      return (
                        <div className="review-item" key={line.id}>
                          <div className="review-item-media">
                            <div className="gold-bar-container" style={{ width: p.w - 12 }}>
                              <img className="gold-bar-img" src={`/${p.img}`} alt={p.name} />
                            </div>
                          </div>
                          <div className="review-item-info">
                            <b>{p.name}</b>
                            <span>
                              Qty {line.qty} &times; {gba ? gba.fmtRM(p.price) : `RM ${p.price}`}
                            </span>
                          </div>
                          <div className="review-item-price">{gba ? gba.fmtRM(p.price * line.qty) : `RM ${p.price * line.qty}`}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="summary-divider"></div>
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span id="coSubtotal">{gba ? gba.fmtRM(subtotal) : "RM 0"}</span>
                  </div>
                  <div className="summary-row">
                    <span>Delivery &amp; Insurance</span>
                    <span id="coDelivery">
                      {deliveryFee === 0 ? "Complimentary" : gba ? gba.fmtRM(deliveryFee) : `RM ${deliveryFee}`}
                    </span>
                  </div>
                  <div className="summary-row muted">
                    <span>SST</span>
                    <span>Exempt &mdash; Investment Gold</span>
                  </div>
                  <div className="summary-divider"></div>
                  <div className="summary-total">
                    <span className="stlabel">Total</span>
                    <span className="stvalue" id="coTotal">
                      {gba ? gba.fmtRM(total) : "RM 0"}
                    </span>
                  </div>
                  <div className="summary-note">
                    <svg viewBox="0 0 24 24">
                      <rect height="9" rx="1.5" width="14" x="5" y="11"></rect>
                      <path d="M8 11V7a4 4 0 018 0v4"></path>
                    </svg>
                    <span>Payment details are encrypted. GBA Asset never stores full card numbers.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "confirmed" && (
            <div className="panel order-success" id="orderSuccess">
              <div className="order-success-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </div>
              <h2>Order Confirmed</h2>
              <p>
                Thank you for your purchase. A confirmation has been sent to your email, and our bullion specialists
                will be in touch shortly to arrange the next steps.
              </p>
              <div className="order-id" id="orderIdText">
                {orderId}
              </div>
              <br />
              <Link className="btn btn-primary" data-ripple="" href="/#top">
                Return to Home
              </Link>
            </div>
          )}
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
