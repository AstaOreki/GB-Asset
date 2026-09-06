"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useGBA } from "../../hooks/useGBA";

/**
 * "Request a Private Consultation" enquiry form — extracted from the
 * homepage so the same markup/logic can render both inline on "/"
 * (id="contact", anchored by the hero's #contact-adjacent nav) and on its
 * own dedicated "/contact" route.
 *
 * @param {{ showPageLink?: boolean }} props showPageLink renders a "View
 *   Contact Us" link to /contact — only passed true from the homepage.
 */
export default function ContactSection({ showPageLink = false }) {
  const gba = useGBA();

  const formRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const messageRef = useRef(null);
  const [consultState, setConsultState] = useState("");
  const [consultStatus, setConsultStatus] = useState("We will get back to you as soon as possible.");
  const [consultSubmitting, setConsultSubmitting] = useState(false);

  function handleConsultSubmit(e) {
    e.preventDefault();
    const name = nameRef.current.value.trim();
    const phone = phoneRef.current.value.trim();
    const email = emailRef.current.value.trim();
    const message = messageRef.current.value.trim();
    if (!name || !phone) {
      setConsultStatus("Please provide your full name and phone number.");
      return;
    }
    if (!gba) return;
    setConsultSubmitting(true);
    gba.consultations
      .submit({ name: name, phone: phone, email: email, location: consultState, org: "", message: message })
      .then(() => {
        setConsultStatus("Thank you — a bullion specialist will be in touch shortly.");
        formRef.current.reset();
        setConsultState("");
        setConsultSubmitting(false);
      })
      .catch(() => {
        setConsultStatus("Something went wrong sending your enquiry. Please try again.");
        setConsultSubmitting(false);
      });
  }

  return (
    <section className="consult" id="contact">
      <div className="wrap consult-inner">
        <div className="consult-intro reveal">
          <div className="eyebrow">We Buy Your Gold</div>
          <h2>Request a Private Consultation</h2>
          <p>
            Speak with our bullion specialists for a confidential valuation and offer, or any enquiry regarding our
            gold products.
          </p>
          {showPageLink && (
            <div className="section-cta reveal">
              <Link className="btn btn-outline" href="/contact">
                View Contact Us
              </Link>
            </div>
          )}
        </div>

        <form className="glass-card reveal" id="consultForm" ref={formRef} onSubmit={handleConsultSubmit}>
          <div className="field">
            <input id="consultName" ref={nameRef} placeholder=" " required type="text" />
            <label>Full Name *</label>
          </div>
          <div className="field">
            <input id="consultPhone" ref={phoneRef} placeholder=" " required type="text" />
            <label>Phone Number *</label>
          </div>
          <div className="field">
            <input id="consultEmail" ref={emailRef} placeholder=" " type="email" />
            <label>Email Address</label>
          </div>
          <div className="field">
            <select
              id="consultState"
              data-empty={consultState === "" ? "true" : "false"}
              value={consultState}
              onChange={(e) => setConsultState(e.target.value)}
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
            <textarea id="consultMessage" ref={messageRef} placeholder=" "></textarea>
            <label>Message</label>
          </div>
          <button className="submit-btn" data-ripple="" type="submit" disabled={consultSubmitting}>
            Submit Enquiry
          </button>
          <div className="submit-sub" id="consultStatus">
            {consultStatus}
          </div>
        </form>
      </div>
    </section>
  );
}
