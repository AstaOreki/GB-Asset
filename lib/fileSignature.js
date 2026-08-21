// Real content-sniffing for receipt uploads, on top of the existing
// extension/MIME check in app/api/orders/upload-receipt — a renamed file
// (e.g. a .exe saved as "receipt.jpg") passes the extension/MIME check
// since both are just client-supplied labels; the actual file bytes don't
// lie. Signatures per https://en.wikipedia.org/wiki/List_of_file_signatures.
const SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
};

export function isValidFileSignature(buffer, mimeType) {
  const signatures = SIGNATURES[mimeType];
  if (!signatures) return false;
  return signatures.some((bytes) => bytes.every((byte, i) => buffer[i] === byte));
}
