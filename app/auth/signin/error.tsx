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
    <div className="flex h-screen w-screen flex-col items-center justify-center py-12">
      <div className="wrapper">
        <div className="space-y-4 text-center">
          <h1 className="font-style-h1">Something went wrong!</h1>
          <p className="text-destructive">{error.message}</p>
        </div>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  )
}
