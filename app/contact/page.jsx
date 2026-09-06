import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import ContactSection from "../../components/sections/ContactSection";
import "../page.css";

export const metadata = {
  title: "Contact Us | GB Asset",
  description:
    "Request a private consultation with GBA Gold's bullion specialists for a confidential valuation, offer, or any enquiry about our gold products.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Us | GB Asset",
    description:
      "Request a private consultation with GBA Gold's bullion specialists for a confidential valuation, offer, or any enquiry about our gold products.",
    url: "https://gbagold.my/contact",
  },
};

export default function ContactPage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />
      <main className="subpage">
        <ContactSection />
      </main>
      <FullFooter />
    </>
  );
}
