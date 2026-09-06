import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import PriceTodaySection from "../../components/sections/PriceTodaySection";
import "../page.css";

export const metadata = {
  title: "Price Today | GB Asset",
  description:
    "Official daily Sell / Buy rates for every GBA Gold bar, 999.9 fine gold — updated daily with a full historical record and price trend charts.",
  alternates: { canonical: "/price-today" },
  openGraph: {
    title: "Price Today | GB Asset",
    description:
      "Official daily Sell / Buy rates for every GBA Gold bar, 999.9 fine gold — updated daily with a full historical record and price trend charts.",
    url: "https://gbagold.my/price-today",
  },
};

export default function PriceTodayPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />
      <main className="subpage">
        <PriceTodaySection />
      </main>
      <FullFooter />
    </>
  );
}
