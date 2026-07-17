/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/openapi": ["./openapi/action-items.openapi.yaml"]
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "portal.raidguild.org" }],
  },
};

export default nextConfig;
