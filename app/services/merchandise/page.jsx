import Link from "next/link";
import StorefrontHeader from "../../../components/StorefrontHeader";
import FullFooter from "../../../components/FullFooter";
import RevealOnScroll from "../../../components/RevealOnScroll";
import "../../page.css";

/**
 * "/services/merchandise" — the detail behind the Merchandise & Gift service
 * card. Built from the same section/card patterns as the rest of the site
 * (section-head, the .service-card panel treatment, the store-page top
 * offset) rather than a new visual language.
 *
 * TO ADD MORE PHOTOS: drop the files into `public/image/` and add one entry
 * per photo below. Nothing else needs to change — the gallery lays itself
 * out, keeps each image's own aspect ratio, and the whole block is skipped
 * while the list is empty so the page never shows an empty frame.
 *
 * The filenames contain spaces, so the space is percent-encoded here; the
 * parentheses are legal in a URL path and are left as-is.
 */
const MERCHANDISE_IMAGES = Array.from({ length: 8 }, (_, i) => ({
  src: `/image/GIFT%20(${i + 1}).jpeg`,
  alt: `GBA Custom Gold Gift Set — presentation box, gift bag and personalised gold card, design ${i + 1} of 8`,
}));

export const metadata = {
  title: "Merchandise & Gift | GB Asset",
  description:
    "The GBA Custom Gold Gift Set — a premium personalised keepsake created to celebrate people, milestones and moments that matter.",
  alternates: { canonical: "/services/merchandise" },
  openGraph: {
    title: "Merchandise & Gift | GB Asset",
    description:
      "The GBA Custom Gold Gift Set — a premium personalised keepsake created to celebrate people, milestones and moments that matter.",
    url: "https://gbagold.my/services/merchandise",
  },
};

export default function MerchandisePage() {
  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />

      <main className="subpage">
        <section className="services" id="merchandise">
          <div className="wrap">
            <div className="section-head on-dark reveal">
              <div className="eyebrow">Merchandise &amp; Gift</div>
              <h1>Turn Your Moments Into Something Worth Keeping</h1>
            </div>

            {MERCHANDISE_IMAGES.length > 0 && (
              <div className="merch-gallery reveal-stagger">
                {MERCHANDISE_IMAGES.map((img) => (
                  <figure className="merch-figure" key={img.src}>
                    {/* Plain <img> with height:auto — the photos keep their
                        own aspect ratio and are never cropped or stretched. */}
                    <img alt={img.alt} loading="lazy" src={img.src} />
                  </figure>
                ))}
              </div>
            )}

            <div className="merch-caption reveal">
              <h2>GBA Custom Gold Gift Set</h2>
              <p>
                A premium personalised keepsake created to celebrate people, milestones and moments that matter.
              </p>
              <Link className="btn btn-primary merch-cta" data-ripple="" href="/#contact">
                Enquire About a Gift Set
              </Link>
            </div>
          </div>
        </section>
      </main>

      <FullFooter />
    </>
  );
}
