// app/auth/signin/error.tsx
'use client'

import React from 'react'

export default function Error({
  error,
}: {
  error: Error & { digest?: string }
}): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center py-12">
      <div className="wrapper space-y-4 text-center">
        <h1 className="text-3xl font-bold sm:text-5xl">
          Something went wrong!
        </h1>
        <p className="text-destructive">{error.message}</p>
      </div>
    </div>
  )
}
