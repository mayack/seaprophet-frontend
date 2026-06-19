import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow HMR when testing from a phone on the LAN (update IP if it changes).
  allowedDevOrigins: ['192.168.1.110'],
  images: {
    formats: ['image/webp', 'image/avif'],
  },
}

export default nextConfig
