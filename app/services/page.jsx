import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import "../page.css";

/**
 * "/services" — the Services grid lifted verbatim off the homepage. Markup
 * and classes are unchanged, so the six cards look exactly as they did;
 * only the section heading is promoted from h2 to h1, since it is now the
 * page's own title.
 *
 * A server component so it can export its own metadata — the reveal
 * animation is armed by the RevealOnScroll client helper instead of a hook
 * on this file.
 */
export const metadata = {
  title: "Our Services | GB Asset",
  description:
    "Complete, transparent precious metals solutions from GBA Gold — buying and selling, jewellery purchase, gold valuation, precious metals trading, asset consultation, and redemption and resale.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Our Services | GB Asset",
    description:
      "Complete, transparent precious metals solutions from GBA Gold — buying and selling, jewellery purchase, gold valuation, precious metals trading, asset consultation, and redemption and resale.",
    url: "https://gbagold.my/services",
  },
};

export default function ServicesPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />

      <main className="subpage">
        <section className="services" id="services">
          <div className="wrap">
            <div className="section-head on-dark reveal">
              <div className="eyebrow">What We Offer</div>
              <h1>Our Services</h1>
              <p>Complete, transparent precious metals solutions — from valuation to trading.</p>
            </div>
            <div className="services-grid reveal-stagger">
              <div className="service-card">
                <div className="service-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 8h13M17 8l-4-4M20 16H7M7 16l4 4"></path>
                  </svg>
                </div>
                <h4>Buying &amp; Selling</h4>
                <p>Gold and silver trading with fair, competitive pricing on every transaction.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2l2.5 5.5L20 9l-4.2 3.8L17 19l-5-3.2L7 19l1.2-6.2L4 9l5.5-1.5z"></path>
                  </svg>
                </div>
                <h4>Jewellery Purchase</h4>
                <p>We purchase used, damaged and unwanted jewellery at honest, accurate valuations.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 006 0l-3-6zM19 7l-3 6a3 3 0 006 0l-3-6z"></path>
                  </svg>
                </div>
                <h4>Gold Valuation</h4>
                <p>Precise, professional evaluation of gold and precious metal assets.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 17l6-6 4 4 8-8M15 7h6v6"></path>
                  </svg>
                </div>
                <h4>Precious Metals Trading</h4>
                <p>Secure, market-aligned trading across gold and silver assets.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8-1.5 0-2.9-.3-4.1-.9L3 20l1-4.2C3.4 14.6 3 13.3 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"></path>
                  </svg>
                </div>
                <h4>Asset Consultation</h4>
                <p>Guidance on monetising your valuable precious metal assets, tailored to you.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3l7 3v6c0 5-3.3 7.6-7 9-3.7-1.4-7-4-7-9V6l7-3Z"></path>
                    <path d="M9 12.2l2.1 2.1L15.3 10"></path>
                  </svg>
                </div>
                <h4>Redemption &amp; Resale</h4>
                <p>Assistance with eligible gold redemption and resale processes, where applicable.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FullFooter />
    </>
  );
}
