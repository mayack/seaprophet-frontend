import { Spinner } from '@/components/ui/spinner'
import React from 'react'

// Renders inside `(authenticated)/layout.tsx`'s `<main>` while a spot
// page resolves. Sized to fill the viewport below the 64px header
// rather than overlaying it (don't use `fixed inset-0` here).
export default function Loading(): React.JSX.Element {
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{ minHeight: 'calc(100dvh - 64px)' }}
    >
      <Spinner size="lg" />
    </div>
  )
}
