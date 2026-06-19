import { Spinner } from '@/components/ui/spinner'
import React from 'react'

export default function Loading(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background">
      <Spinner className="size-8" />
    </div>
  )
}
