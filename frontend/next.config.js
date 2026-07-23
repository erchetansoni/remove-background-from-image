/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API calls to the FastAPI service so the browser talks same-origin
  // (no CORS). In Docker the destination is the `backend` service name; when
  // running Next locally it falls back to localhost.
  async rewrites() {
    const api = process.env.INTERNAL_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${api}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
