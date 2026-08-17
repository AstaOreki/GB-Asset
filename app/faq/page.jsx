import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import FaqAccordion from "../../components/FaqAccordion";
import "../page.css";

/**
 * "/faq" — Frequently Asked Questions. Same server-component + RevealOnScroll
 * pattern as /about and /services: metadata lives here, the reveal animation
 * is armed by the client helper, and the page reuses page.css rather than
 * introducing a second stylesheet.
 */
export const metadata = {
  title: "Frequently Asked Questions | GB Asset",
  description:
    "Answers to common questions about GBA Gold's pricing, physical gold custody, delivery and collection, and how our pricing compares to other gold sellers.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Frequently Asked Questions | GB Asset",
    description:
      "Answers to common questions about GBA Gold's pricing, physical gold custody, delivery and collection, and how our pricing compares to other gold sellers.",
    url: "https://gbagold.my/faq",
  },
};

// Content as supplied, with only light copy-editing for readability
// (punctuation/flow) — no meaning changed.
const FAQ_ITEMS = [
  {
    question: "How does the GBA Gold market operate 24 hours a day?",
    answer:
      "GBA Gold uses the Malaysian market price from 9:00 a.m. to 5:00 p.m. After Malaysian market hours, pricing continues based on the International Spot Gold price and the USD/MYR exchange rate, allowing GBA Gold prices to remain updated around the clock.",
  },
  {
    question: "What is the main difference between GBA Gold and other gold investment companies or trading platforms?",
    answer:
      "GBA Gold encourages customers to acquire real physical gold. The gold can be sold at any time, or customers may choose to hold it as a long-term asset while retaining its value.",
  },
  {
    question: "Can I keep my physical gold?",
    answer: "Yes. We encourage customers to keep their physical gold as a long-term asset holding.",
  },
  {
    question: "Can GBA Gold, as a company, hold my gold?",
    answer: "Yes. GBA Gold can hold your gold if you are an active individual customer who regularly buys and sells gold.",
  },
  {
    question: "How fast will my gold be delivered after purchase, or how can I collect it?",
    answer:
      "Delivery by a safe and insured courier may take up to 5 working days. Alternatively, you may arrange to collect your gold directly from a GBA Gold officer at a mutually agreed time.",
  },
  {
    question: "Is the price of GBA Gold lower and more competitive compared to other gold sellers?",
    answer:
      "Yes. GBA Gold is able to offer competitive pricing because it does not operate using an MLM or agent-commission-based business model. Our business model is focused on serving individuals, institutions and organisations that wish to buy or sell gold for either short-term or long-term purposes.",
  },
];

export default function FaqPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />

      <main className="subpage">
        <section className="faq" id="faq">
          <div className="wrap">
            <div className="section-head on-dark reveal">
              <div className="eyebrow">Q&amp;A</div>
              <h1>Frequently Asked Questions</h1>
              <p>Straight answers about pricing, holding your gold, delivery and collection.</p>
            </div>

            <div className="faq-panel reveal">
              <FaqAccordion items={FAQ_ITEMS} />
            </div>
          </div>
        </section>
      </main>

      <FullFooter />
    </>
  );
}
