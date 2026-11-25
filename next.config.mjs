/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./lib/agent/embeddings.json"],
  },
  async redirects() {
    return [{ source: "/", destination: "/fr", permanent: false }];
  },
};

export default nextConfig;
