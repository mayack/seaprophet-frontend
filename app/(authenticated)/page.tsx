import { Suspense } from 'react'
import React from 'react'
import { MapNavigator } from '@/components/maps/MapNavigator'

// <MapNavigator /> is a client component. Wrapping its render in a
// server-side try/catch here cannot catch errors thrown during the
// client component's runtime (those happen after this server component
// has finished rendering). Client errors propagate to the nearest
// `error.tsx` boundary in the App Router; add one in this segment if a
// scoped fallback is wanted instead of the global one.
export default function Page(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="bg-muted" style={{ height: 'calc(100dvh - 64px)' }} />
      }
    >
      <MapNavigator height="calc(100dvh - 64px)" initialRadius={250} />
    </Suspense>
  )
}
