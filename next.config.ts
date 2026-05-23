import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Performance optimizations
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Re-enable the client-side Router Cache for dynamic routes (default is 0s
    // in Next 15). Lets back/forward and re-visits to /spot/[id] hydrate from
    // memory instead of triggering a fresh server render + forecast fetch.
    staleTimes: {
      dynamic: 60, // seconds
      static: 300,
    },
  },

  // Compression
  compress: true,
}

// Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig)
