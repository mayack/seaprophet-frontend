import { Spinner } from '@/components/ui/spinner'
import React from 'react'

// Shown inside the (already-open) spot box while the spot data loads on a
// direct load / refresh of /spot/[id].
export default function Loading(): React.JSX.Element {
  return (
    <div className="flex min-h-[60dvh] w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
