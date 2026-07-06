import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

var withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

var nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "shopify-staged-uploads.storage.googleapis.com" },
    ],
  },
  compress: true,
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
};

export default withBundleAnalyzer(nextConfig);
