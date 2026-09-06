import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import PricingSection from "../../components/sections/PricingSection";
import "../page.css";

export const metadata = {
  title: "Pricing | GB Asset",
  description:
    "Today's wholesaler factory price for GBA Gold's certified 999.9 fine gold bars, from 1 gram to 1 kilo.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | GB Asset",
    description:
      "Today's wholesaler factory price for GBA Gold's certified 999.9 fine gold bars, from 1 gram to 1 kilo.",
    url: "https://gbagold.my/pricing",
  },
};

export default function PricingPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />
      <main className="subpage">
        <PricingSection />
      </main>
      <FullFooter />
    </>
  );
}
