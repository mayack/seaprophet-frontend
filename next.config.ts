import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Performance optimizations
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Compression
  compress: true,
}

// Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig)
