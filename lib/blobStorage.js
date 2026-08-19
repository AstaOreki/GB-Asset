// Payment receipt storage, via Vercel Blob rather than Firebase Storage —
// switched because Firebase Storage now requires the project to be on the
// paid Blaze plan just to provision it at all, which wasn't something to
// force on this project. Vercel Blob needs nothing beyond BLOB_READ_WRITE_TOKEN,
// which Vercel auto-injects once a Blob store is created and connected to
// this project (Vercel dashboard -> Storage -> Create Database -> Blob).
//
// Security model, and why it's different from the Firebase version this
// replaced: uploads use access: "public" with a random suffix appended to
// the path, so the resulting URL is a long, unguessable token rather than
// a real access-controlled resource — @vercel/blob's "private" access mode
// exists but requires a separate presigned-token delegation flow this
// project doesn't use, so it isn't relied on here. In practice this means
// a receipt is reachable by anyone who has the exact URL, the same trust
// model as an "anyone with the link" share link. What still IS enforced is
// who ever RECEIVES that URL: it only ever gets written into an order
// document, which firestore.rules restricts to that order's own owner or
// an admin — nothing here makes the URL discoverable on its own.
import { put } from "@vercel/blob";

export async function uploadReceiptBlob(objectPath, buffer, contentType) {
  const { url } = await put(objectPath, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return url;
}
