import { Spinner } from '@/components/ui/spinner'
import React from 'react'

export default function RootLoading(): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-[100] flex size-full flex-col items-center justify-center gap-4 bg-background">
      <Spinner size="lg" />
    </div>
  )
}
