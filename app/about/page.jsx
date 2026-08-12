import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import "../page.css";

/**
 * "/about" — the About Us content lifted verbatim off the homepage: the
 * company story, the vision/mission panel and the T.R.U.S.T core values.
 * Markup and classes are unchanged from what they were inline, so the
 * sections look exactly as they did; only the heading of the first section
 * is promoted from h2 to h1, since it is now the page's own title.
 *
 * A server component so it can export its own metadata — the reveal
 * animation is armed by the RevealOnScroll client helper instead of a hook
 * on this file.
 */
export const metadata = {
  title: "About Us | GB Asset",
  description:
    "GBA Gold is a trusted precious metals trading brand under GB Asset Trading, specialising in the buying and selling of gold and silver with transparency, fair valuation and professional service.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Us | GB Asset",
    description:
      "GBA Gold is a trusted precious metals trading brand under GB Asset Trading, specialising in the buying and selling of gold and silver with transparency, fair valuation and professional service.",
    url: "https://gbagold.my/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />

      <main className="subpage">
        <section className="heritage" id="heritage">
          <div className="wrap heritage-grid">
            <div className="heritage-visual reveal">
              <img alt="Premium Bullion Collection" className="heritage-photo" src="/image/gold_bars_group.png" />
            </div>
            <div className="heritage-text reveal">
              <div className="eyebrow">About Us</div>
              <h1>GBA Gold</h1>
              <p>
                GBA Gold is a trusted precious metals trading brand under GB Asset Trading, specialising in the buying and
                selling of gold and silver with a commitment to transparency, fair valuation and professional service.
              </p>
              <p>
                We provide reliable solutions for individuals who wish to sell used jewellery, damaged gold, unwanted
                precious metals or monetise their valuable assets through a secure and straightforward process.
              </p>
              <p>
                Our experienced team focuses on accurate evaluation, competitive pricing and ethical business practices
                to ensure every customer enjoys a smooth and trusted experience.
              </p>
              <p className="promise-line">
                At GBA Gold, we believe every gram has value, and every customer deserves honesty, respect and confidence
                in every transaction.
              </p>
            </div>
          </div>
        </section>

        <section className="pvm">
          <div className="wrap pvm-grid">
            <div className="pvm-col reveal">
              <div className="eyebrow">Our Promise</div>
              <h3>
                Fair Value.
                <br />
                Trusted Service.
                <br />
                Lasting Relationships.
              </h3>
            </div>
            <div className="pvm-col reveal">
              <div className="eyebrow">Company Vision</div>
              <h3>Our Vision</h3>
              <p>
                To become one of Malaysia&apos;s most trusted precious metals trading companies, delivering secure,
                transparent and value-driven solutions for every customer.
              </p>
            </div>
            <div className="pvm-col reveal">
              <div className="eyebrow">Our Mission</div>
              <h3>What Drives Us</h3>
              <ul className="mission-list">
                <li>
                  <b>*</b>Deliver fair and transparent pricing.
                </li>
                <li>
                  <b>*</b>Build long-term customer trust.
                </li>
                <li>
                  <b>*</b>Promote responsible precious metals trading.
                </li>
                <li>
                  <b>*</b>Provide professional asset valuation services.
                </li>
                <li>
                  <b>*</b>Continuously improve customer experience.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="core-values" id="values">
          <div className="wrap">
            <div className="section-head reveal">
              <div className="eyebrow">Core Values</div>
              <h2>T.R.U.S.T</h2>
              <p>The five principles that guide every transaction at GBA Gold.</p>
            </div>
            <div className="trust-word reveal-stagger">
              <div className="trust-letter">
                <span className="lg">T</span>
                <b>Transparency</b>
                <span>Open, honest dealings</span>
              </div>
              <div className="trust-letter">
                <span className="lg">R</span>
                <b>Respect</b>
                <span>Every customer valued</span>
              </div>
              <div className="trust-letter">
                <span className="lg">U</span>
                <b>Unity</b>
                <span>One team, one purpose</span>
              </div>
              <div className="trust-letter">
                <span className="lg">S</span>
                <b>Service Excellence</b>
                <span>Professional, every time</span>
              </div>
              <div className="trust-letter">
                <span className="lg">T</span>
                <b>Trust</b>
                <span>Earned in every gram</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FullFooter />
    </>
  );
}
