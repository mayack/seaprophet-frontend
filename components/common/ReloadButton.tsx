'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface ReloadButtonProps {
  className?: string
}

export function ReloadButton({
  className,
}: ReloadButtonProps): React.JSX.Element {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className={className}
    >
      Try again
    </button>
  )
}
