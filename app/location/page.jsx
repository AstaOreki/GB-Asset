import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import LocationSection from "../../components/sections/LocationSection";
import "../page.css";

export const metadata = {
  title: "Location | GB Asset",
  description:
    "Visit GBA Gold's showroom in Binjai 8 Premium Soho, KLCC, Kuala Lumpur for an in-store bullion valuation or to view our gold collection in person.",
  alternates: { canonical: "/location" },
  openGraph: {
    title: "Location | GB Asset",
    description:
      "Visit GBA Gold's showroom in Binjai 8 Premium Soho, KLCC, Kuala Lumpur for an in-store bullion valuation or to view our gold collection in person.",
    url: "https://gbagold.my/location",
  },
};

export default function LocationPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />
      <main className="subpage">
        <LocationSection />
      </main>
      <FullFooter />
    </>
  );
}
