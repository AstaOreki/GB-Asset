import MinimalHeader from "../../components/MinimalHeader";
import MinimalFooter from "../../components/MinimalFooter";
import { unsubscribeByToken } from "../../lib/newsletter";
import "./unsubscribe.css";

/**
 * "/unsubscribe?token=..." — the link every newsletter footer points at.
 * An async server component performs the unsubscribe directly (no client
 * fetch round-trip needed) by importing lib/newsletter.js's server-only
 * unsubscribeByToken() straight into the render — the same function
 * app/api/newsletter/unsubscribe/route.js calls for RFC 8058 one-click
 * requests from mail clients, so there is one implementation either way.
 *
 * Same MinimalHeader/MinimalFooter shell as /login and /privacy-policy —
 * this is a one-off transactional page, not a storefront page, so it
 * doesn't need StorefrontHeader's cart badge / auth button.
 */
export const metadata = {
  title: "Unsubscribe | GB Asset",
};

export default async function UnsubscribePage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : null;

  let result;
  try {
    result = await unsubscribeByToken(token);
  } catch (err) {
    result = { ok: false, error: err.message || "Something went wrong. Please try again shortly." };
  }

  return (
    <>
      <MinimalHeader />
      <main className="unsub-page">
        <div className="wrap">
          <div className="unsub-card">
            {result.ok ? (
              <>
                <div className="unsub-icon is-ok" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h1>You have been unsubscribed successfully.</h1>
                <p>
                  {result.email ? <>{result.email} will</> : <>You will</>} no longer receive GBA Gold Daily
                  Updates. You can resubscribe any time from the homepage.
                </p>
              </>
            ) : (
              <>
                <div className="unsub-icon is-error" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6 6 18"></path>
                  </svg>
                </div>
                <h1>We couldn&apos;t process that request.</h1>
                <p>{result.error}</p>
              </>
            )}
            <a className="unsub-home-btn" href="/">
              Return to GBA Gold
            </a>
          </div>
        </div>
      </main>
      <MinimalFooter />
    </>
  );
}
