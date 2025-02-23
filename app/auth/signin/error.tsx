'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      <div className="container space-y-4 py-12 text-center">
        <h1 className="text-lg font-semibold">Something went wrong!</h1>
        <p className="text-sm text-destructive">{error.message}</p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  )
}
