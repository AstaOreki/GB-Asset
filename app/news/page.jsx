import Link from "next/link";
import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import RevealOnScroll from "../../components/RevealOnScroll";
import { getAdminDb } from "../../lib/firebaseAdmin";
import "./news.css";

// Reads Firestore fresh on every request — a static/ISR page would cache
// the article list, so publishing/unpublishing from the admin dashboard
// wouldn't show up on the live site until the next deploy or revalidation.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "News | GB Asset",
  description: "The latest announcements and updates from GBA Gold.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "News | GB Asset",
    description: "The latest announcements and updates from GBA Gold.",
    url: "https://gbagold.my/news",
  },
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// Server component reading Firestore directly via firebase-admin (rather
// than the client `window.GBA` singleton every other public component
// uses) so this page is fully server-rendered and crawlable — SEO for News
// matters more here than for e.g. Announcements, which is fine to be
// client-only.
async function getPublishedNews() {
  const db = getAdminDb();
  if (!db) return [];
  try {
    const snap = await db.collection("news").where("published", "==", true).orderBy("date", "desc").get();
    return snap.docs.map((doc) => ({ docId: doc.id, ...doc.data() }));
  } catch (err) {
    // Most likely cause: the composite index for published+date hasn't
    // finished building yet (Firestore throws FAILED_PRECONDITION with a
    // console link until it does) — degrade to an empty list rather than
    // 500ing the whole page.
    console.error("news: published query failed", err);
    return [];
  }
}

export default async function NewsPage() {
  const articles = await getPublishedNews();

  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />
      <main className="subpage news-page">
        <section className="news-hero">
          <div className="wrap">
            <div className="eyebrow">Announcements &amp; Updates</div>
            <h1>News</h1>
            <p>The latest announcements, market updates and stories from GBA Gold.</p>
          </div>
        </section>

        <section className="news-list-section">
          <div className="wrap">
            {articles.length === 0 ? (
              <div className="news-empty">
                <p>No news articles have been published yet — check back soon.</p>
              </div>
            ) : (
              <div className="news-grid">
                {articles.map((a) => (
                  <Link className="news-card" href={`/news/${a.slug}`} key={a.docId}>
                    <div className="news-card-poster">
                      {a.posterUrl ? (
                        <img alt={a.title} src={a.posterUrl} />
                      ) : (
                        <div className="news-card-poster-fallback" aria-hidden="true" />
                      )}
                    </div>
                    <div className="news-card-body">
                      {a.category && <span className="news-card-category">{a.category}</span>}
                      <span className="news-card-date">{formatDate(a.date)}</span>
                      <h2>{a.title}</h2>
                      {a.excerpt && <p>{a.excerpt}</p>}
                      <span className="news-card-readmore">Read More →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <FullFooter />
    </>
  );
}
