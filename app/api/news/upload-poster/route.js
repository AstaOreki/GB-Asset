import { getRequestAdmin } from "../../../../lib/adminAuth";
import { uploadNewsPosterBlob } from "../../../../lib/blobStorage";
import { isValidFileSignature } from "../../../../lib/fileSignature";

export const runtime = "nodejs";

const POSTER_MIME_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};
const POSTER_MAX_BYTES = 5 * 1024 * 1024;

function extensionOf(filename) {
  const m = /\.[^.]+$/.exec(filename || "");
  return m ? m[0].toLowerCase() : "";
}

function sanitizeFilename(filename) {
  const base = String(filename || "poster").replace(/[/\\]/g, "_");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

// Admin-only (unlike upload-receipt, which is customer-only for their own
// order) — News Management is an admin dashboard feature. Body is
// multipart form data with a single "file" field.
export async function POST(request) {
  const admin = await getRequestAdmin(request);
  if (!admin) return Response.json({ error: "Not authorized." }, { status: 403 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Please choose a poster image to upload." }, { status: 400 });
  }
  if (file.size > POSTER_MAX_BYTES) {
    return Response.json({ error: "That image is too large — please upload a file under 5MB." }, { status: 400 });
  }
  const allowedExts = POSTER_MIME_TYPES[file.type];
  const ext = extensionOf(file.name);
  if (!allowedExts || !allowedExts.includes(ext)) {
    return Response.json({ error: "Only JPG or PNG images are accepted." }, { status: 400 });
  }

  let posterUrl;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isValidFileSignature(buffer, file.type)) {
      return Response.json({ error: "That file doesn't look like a valid JPG or PNG." }, { status: 400 });
    }
    const objectPath = `news/${Date.now()}_${sanitizeFilename(file.name)}`;
    posterUrl = await uploadNewsPosterBlob(objectPath, buffer, file.type);
  } catch (err) {
    console.error("upload-poster: blob upload failed", err);
    return Response.json({ error: "Could not upload the poster — please try again." }, { status: 500 });
  }

  return Response.json({ url: posterUrl });
}
