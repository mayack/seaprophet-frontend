'use client'
import React from 'react'

export default function Error({ error }: { error: Error }): React.JSX.Element {
  return (
    <div className="wrapper space-y-4 py-12 text-center">
      <h1 className="text-3xl font-bold sm:text-5xl">Error</h1>
      <p className="text-red-600">{error.message}</p>
    </div>
  )
}
