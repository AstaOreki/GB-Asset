/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this folder — an unrelated package-lock.json
  // in the user's home directory otherwise makes Next.js guess wrong.
  turbopack: {
    root: __dirname,
  },
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
