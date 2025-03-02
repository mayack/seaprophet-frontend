import { Spinner } from '@/components/ui/spinner'
import React from 'react'

export function Loading({
  size = 'md',
}: {
  size: 'sm' | 'md' | 'lg'
}): React.JSX.Element {
  return <Spinner size={size} />
}
