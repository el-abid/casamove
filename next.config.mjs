/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./lib/agent/embeddings.json"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    const locales = ["fr", "ar", "en"];
    const legacy = [
      "journey",
      "network",
      "traffic",
      "reports",
      "assistance",
    ];

    return [
      { source: "/", destination: "/fr", permanent: false },
      ...locales.flatMap((locale) =>
        legacy.map((path) => ({
          source: `/${locale}/${path}`,
          destination: `/${locale}/tram/${path}`,
          permanent: false,
        }))
      ),
      ...locales.map((locale) => ({
        source: `/${locale}/tram/account`,
        destination: `/${locale}/account`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
