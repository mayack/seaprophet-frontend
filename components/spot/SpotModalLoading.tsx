import { Spinner } from '@/components/ui/spinner'
import React from 'react'

/** Shared loading state for spot modal routes. */
export function SpotModalLoading(): React.JSX.Element {
  return (
    <div className="flex min-h-[60dvh] w-full items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}
