"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGBA } from "../hooks/useGBA";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * "Latest News" homepage preview — same shape as AnnouncementBanner
 * (useGBA() + a realtime listener), but reads the public `news` feed and
 * shows the 3 most recent published articles, linking through to the full
 * /news list and each article's own /news/[slug] page.
 *
 * Renders nothing while loading or if there are no published articles yet,
 * so an empty News section never appears on the homepage.
 */
export default function LatestNews() {
  const gba = useGBA();
  const [articles, setArticles] = useState(null);

  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.news.listenPublished((list) => setArticles(list.slice(0, 3)));
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba]);

  if (!articles || articles.length === 0) return null;

  return (
    <section className="latest-news">
      <div className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">Announcements &amp; Updates</div>
          <h2>Latest News</h2>
        </div>
        <div className="latest-news-grid reveal-stagger">
          {articles.map((a) => (
            <Link className="latest-news-card" href={`/news/${a.slug}`} key={a.docId}>
              <div className="latest-news-poster">
                {a.posterUrl ? (
                  <img alt={a.title} src={a.posterUrl} />
                ) : (
                  <div className="latest-news-poster-fallback" aria-hidden="true" />
                )}
              </div>
              <div className="latest-news-body">
                <span className="latest-news-date">{formatDate(a.date)}</span>
                <h3>{a.title}</h3>
                {a.excerpt && <p>{a.excerpt}</p>}
                <span className="latest-news-readmore">Read More →</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="section-cta reveal">
          <Link className="btn btn-outline" href="/news">
            View All News
          </Link>
        </div>
      </div>
    </section>
  );
}
