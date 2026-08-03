/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this folder — an unrelated package-lock.json
  // in the user's home directory otherwise makes Next.js guess wrong.
  turbopack: {
    root: __dirname,
  },
  // firebase-admin/auth (used by lib/firebaseAdmin.js's getAdminAuth, added
  // for app/api/create-order's ID-token verification) pulls in jwks-rsa ->
  // jose, which Turbopack's bundler fails to load in the deployed function
  // (ERR_REQUIRE_ESM — a CJS/ESM interop conflict in that dependency
  // chain). Marking firebase-admin external skips bundling it entirely and
  // lets Node's own module loader handle it at runtime instead, which
  // doesn't hit this conflict.
  serverExternalPackages: ["firebase-admin"],
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/cart.html', destination: '/cart', permanent: true },
      { source: '/checkout.html', destination: '/checkout', permanent: true },
      { source: '/login.html', destination: '/login', permanent: true },
      { source: '/privacy-policy.html', destination: '/privacy-policy', permanent: true },
    ];
  },
};

module.exports = nextConfig;
