import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporary phone previews use localhost.run. This only affects `next dev`;
  // production deployments do not expose development resources.
  allowedDevOrigins: ["127.0.0.1", "localhost", "100.108.132.20", "*.lhr.life", "*.ts.net"],
};

export default nextConfig;
