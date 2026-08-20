// Payment receipt storage, via Vercel Blob rather than Firebase Storage —
// switched because Firebase Storage now requires the project to be on the
// paid Blaze plan just to provision it at all, which wasn't something to
// force on this project. Vercel Blob needs nothing beyond BLOB_STORE_ID +
// Vercel's ambient VERCEL_OIDC_TOKEN (or BLOB_READ_WRITE_TOKEN), both
// handled automatically by @vercel/blob once a Blob store is connected to
// this project (Vercel dashboard -> Storage -> Create Database -> Blob).
//
// access: "private" is not a preference here, it's required — this
// project's store was created in private mode, and put() throws
// ("Cannot use public access on a private store") if you pass "public"
// against it. Unlike a public store, a private blob's URL is NOT fetchable
// by a plain browser request (confirmed live: a signed-in user's browser
// navigating straight to the URL got a bare "Forbidden") — every read has
// to be an authenticated request. get() (documented under "Delivering
// private blobs" at vercel.com/docs/vercel-blob/private-storage) is the
// sanctioned way to do that server-side; app/api/orders/receipt calls it
// after checking the requester owns the order (or is admin) and streams
// the result back, rather than ever handing the raw URL to a browser.
import { put, get } from "@vercel/blob";

export async function uploadReceiptBlob(objectPath, buffer, contentType) {
  const { url } = await put(objectPath, buffer, {
    access: "private",
    addRandomSuffix: true,
    contentType,
  });
  return url;
}

export async function fetchReceiptBlob(url) {
  // useCache: false — a receipt can be viewed within seconds of being
  // uploaded (customer uploads, admin opens the review modal right away),
  // and Vercel's own docs note a fresh write can take up to 60s to reach
  // the CDN cache; reading through cache here risks a stale/empty result
  // for exactly the case that matters most (the first time it's reviewed).
  const result = await get(url, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new Error("Receipt not found in storage.");
  }
  return { stream: result.stream, contentType: result.blob.contentType };
}
