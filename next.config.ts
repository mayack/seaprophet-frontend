import type { NextConfig } from 'next'

// Inlined into BOTH the client and server bundles at build time (Next inlines
// `env` values during compilation), so a browser tab can ask /api/version
// whether the deployment it's talking to still matches its own build. Netlify
// sets COMMIT_REF; the timestamp fallback covers local builds.
const buildId = process.env.COMMIT_REF || `local-${Date.now().toString(36)}`

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  // Allow HMR when testing from a phone on the LAN (update IP if it changes).
  allowedDevOrigins: ['192.168.1.110'],
  images: {
    formats: ['image/webp', 'image/avif'],
  },
}

export default nextConfig
