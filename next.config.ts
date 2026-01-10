import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000, // Check for changes every second
      aggregateTimeout: 300, // Delay before rebuilding once the first file changed
    };
    return config;
  },
};

export default nextConfig;
