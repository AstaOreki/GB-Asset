import { notFound } from "next/navigation";
import StorefrontHeader from "../../../components/StorefrontHeader";
import FullFooter from "../../../components/FullFooter";
import RevealOnScroll from "../../../components/RevealOnScroll";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import "../news.css";

// Same reasoning as app/news/page.jsx — always read Firestore fresh so an
// edit/publish/unpublish from the admin dashboard shows up immediately.
export const dynamic = "force-dynamic";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// Looked up by slug, not doc id, so /news/[slug] URLs stay readable — see
// firestore.rules for the matching "published only, unless admin" rule.
// This uses firebase-admin (bypasses that rule) so a draft's slug 404s here
// via the explicit `published !== true` check below, rather than relying
// on the client SDK ever being denied the read.
async function getArticleBySlug(slug) {
  const db = getAdminDb();
  if (!db) return null;
  let snap;
  try {
    snap = await db.collection("news").where("slug", "==", slug).limit(1).get();
  } catch (err) {
    console.error("news: slug lookup failed", err);
    return null;
  }
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { docId: doc.id, ...doc.data() };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || article.published !== true) {
    return { title: "News | GB Asset" };
  }
  const description = article.excerpt || article.content?.slice(0, 160) || "";
  return {
    title: `${article.title} | GB Asset`,
    description,
    alternates: { canonical: `/news/${article.slug}` },
    openGraph: {
      title: `${article.title} | GB Asset`,
      description,
      url: `https://gbagold.my/news/${article.slug}`,
      images: article.posterUrl ? [{ url: article.posterUrl }] : undefined,
    },
  };
}

export default async function NewsArticlePage({ params }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  // Unpublished (or non-existent) articles 404 for everyone here — this is
  // what actually keeps a draft off the public site for a direct/guessed
  // URL, on top of firestore.rules blocking the same read for a
  // non-admin client.
  if (!article || article.published !== true) {
    notFound();
  }

  return (
    <>
      <RevealOnScroll />
      <StorefrontHeader />
      <main className="subpage news-page">
        <article className="news-article">
          <div className="wrap news-article-wrap">
            <div className="news-article-meta">
              {article.category && <span className="news-card-category">{article.category}</span>}
              <span className="news-card-date">{formatDate(article.date)}</span>
            </div>
            <h1>{article.title}</h1>
            {article.posterUrl && (
              <div className="news-article-poster">
                <img alt={article.title} src={article.posterUrl} />
              </div>
            )}
            <div className="news-article-content">
              {String(article.content || "")
                .split(/\n{2,}/)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
          </div>
        </article>
      </main>
      <FullFooter />
    </>
  );
}
