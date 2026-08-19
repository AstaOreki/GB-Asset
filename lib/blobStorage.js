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
// against it. Private-store URLs still resolve for whoever has the exact
// URL (same model as before: it's only ever written into an order
// document, which firestore.rules restricts to that order's own owner or
// an admin), the store setting only controls whether "public" is even an
// allowed choice, not whether individual blob URLs themselves need a
// bearer token to fetch.
import { put } from "@vercel/blob";

export async function uploadReceiptBlob(objectPath, buffer, contentType) {
  const { url } = await put(objectPath, buffer, {
    access: "private",
    addRandomSuffix: true,
    contentType,
  });
  return url;
}
