import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@solo-compass/core", "@solo-compass/ai", "@solo-compass/data"],
};

export default withSentryConfig(nextConfig, { silent: true });
