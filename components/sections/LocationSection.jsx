import Link from "next/link";

// The three lines under Our Store Location's "Contact" item. Kept local to
// this section rather than reusing the footer's WhatsApp list — different
// labels/purpose (call this store directly, not message a specific person),
// so a future edit to one doesn't silently change the other.
const STORE_CONTACTS = [
  { number: "012-213 6051", label: "Support Line" },
  { number: "012-240 0600", label: "Izzudin" },
];

/**
 * "Our Store Location" — extracted from the homepage so the same
 * markup can render both inline on "/" (id="location") and on its own
 * dedicated "/location" route. Fully static, so no client hooks are
 * needed — works as either a server or client component.
 *
 * @param {{ showPageLink?: boolean }} props showPageLink renders a "View
 *   Location" link to /location — only passed true from the homepage.
 */
export default function LocationSection({ showPageLink = false }) {
  return (
    <section className="store-location" id="location">
      <div className="wrap store-grid">
        <div className="store-info reveal">
          <div className="eyebrow">Visit Us</div>
          <h2>Our Store Location</h2>
          <p>
            Step into our showroom to view our bullion collection in person, get an in-store valuation, or speak
            directly with our precious metals specialists.
          </p>
          <div className="eyebrow location-tag">Kuala Lumpur</div>
          <div className="store-details">
            <div className="store-detail">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12Z"></path>
                  <circle cx="12" cy="9" r="2.5"></circle>
                </svg>
              </div>
              <div>
                <b>GB Asset</b>
                <span>No. 7, Binjai 8 Premium Soho, Unit 8, Lorong Binjai, KLCC, Kuala Lumpur</span>
              </div>
            </div>
            <div className="store-detail">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 7v5l3.5 2"></path>
                </svg>
              </div>
              <div>
                <b>Opening Hours</b>
                <span>Mon – Sat : 9:00 AM – 6:00 PM</span>
              </div>
            </div>
            <div className="store-detail">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M6.3 17.7 4.5 21.5l3.9-1.7A8.5 8.5 0 1 0 5.2 13a8.4 8.4 0 0 0 1.1 4.7Z"></path>
                </svg>
              </div>
              <div>
                <b>Contact</b>
                <div className="store-contact-list">
                  {STORE_CONTACTS.map((c) => (
                    <div className="store-contact-line" key={c.number}>
                      <span className="store-contact-number">{c.number}</span>
                      <span className="store-contact-label">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="store-location-actions">
            <a
              className="btn btn-primary store-directions-btn"
              data-ripple=""
              href="https://www.google.com/maps/search/?api=1&query=Binjai+8+Premium+Soho,3.15868,101.71742"
              rel="noopener"
              target="_blank"
            >
              Get Directions
            </a>
            {showPageLink && (
              <Link className="btn btn-outline" href="/location">
                View Location
              </Link>
            )}
          </div>
        </div>
        <div className="store-map reveal">
          <iframe
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=Binjai+8+Premium+Soho,3.15868,101.71742&z=17&output=embed"
            title="GB Asset Kuala Lumpur showroom location map"
          ></iframe>
        </div>
      </div>
    </section>
  );
}
