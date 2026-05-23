import { Spinner } from '@/components/ui/spinner'
import React from 'react'

export default function Loading(): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  )
}
