'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { SimpleMap } from './index'
import type { SimpleMapProps } from '@/types/map'

interface SimpleMapSuspenseProps extends SimpleMapProps {
  fallback?: React.ReactNode
}

function SimpleMapSkeleton({ height }: { height?: string }) {
  return (
    <div className="relative bg-muted" style={{ height: height || '200px' }}>
      <Skeleton className="size-full" />
      {/* Optional marker skeleton */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Skeleton className="size-8 rounded-full" />
      </div>
    </div>
  )
}

export function SimpleMapWithSuspense({
  fallback,
  height,
  ...props
}: SimpleMapSuspenseProps) {
  return (
    <Suspense fallback={fallback || <SimpleMapSkeleton height={height} />}>
      <SimpleMap height={height} {...props} />
    </Suspense>
  )
}
