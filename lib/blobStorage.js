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
// to be an authenticated request, so app/api/orders/receipt proxies it:
// fetchReceiptBlob() does that authenticated fetch server-side and the
// route streams the bytes back, after checking the requester owns the
// order (or is admin) the same way every other receipt endpoint did.
import { put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";

// Mirrors @vercel/blob's own internal auth resolution (resolveBlobAuth in
// its source) since the SDK doesn't expose a "fetch blob content" helper
// itself — only put/head/del/list/copy, all metadata/management
// operations. OIDC first (this project's actual setup), falling back to a
// static token if one's ever configured instead.
async function resolveBlobBearer() {
  const storeId = process.env.BLOB_STORE_ID;
  if (storeId) {
    const oidcToken = await getVercelOidcToken().catch(() => undefined);
    if (oidcToken) {
      return { token: oidcToken, storeId: storeId.replace(/^store_/, "") };
    }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN, storeId: undefined };
  }
  throw new Error("No Vercel Blob credentials available.");
}

export async function uploadReceiptBlob(objectPath, buffer, contentType) {
  const { url } = await put(objectPath, buffer, {
    access: "private",
    addRandomSuffix: true,
    contentType,
  });
  return url;
}

export async function fetchReceiptBlob(url) {
  const { token, storeId } = await resolveBlobBearer();
  const headers = { authorization: `Bearer ${token}` };
  if (storeId) headers["x-vercel-blob-store-id"] = storeId;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Blob fetch failed: ${res.status} ${body}`.trim());
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buffer, contentType };
}
