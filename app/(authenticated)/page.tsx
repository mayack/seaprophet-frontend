import { Suspense } from 'react'
import React from 'react'
import { MapNavigator } from '@/components/maps/MapNavigator'

export default function Page(): React.JSX.Element {
  try {
    return (
      <Suspense
        fallback={
          <div className="bg-muted" style={{ height: 'calc(100dvh - 64px)' }} />
        }
      >
        <MapNavigator height="calc(100dvh - 64px)" initialRadius={250} />
      </Suspense>
    )
  } catch (error) {
    return (
      <div className="wrapper">
        <p className="text-red-500">
          Error: {error instanceof Error ? error.message : 'Failed to load map'}
        </p>
      </div>
    )
  }
}
