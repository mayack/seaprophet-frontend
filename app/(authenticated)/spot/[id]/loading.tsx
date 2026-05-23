import { SpotDetailsSkeleton } from '@/components/spot/SpotsDetails/Skeleton'
import React from 'react'

export default function Loading(): React.JSX.Element {
  return (
    <div className="wrapper-spacing mobile-safe-bottom py-4 sm:py-6 xl:py-8">
      <SpotDetailsSkeleton />
    </div>
  )
}
