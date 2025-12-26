'use client'

import React from 'react'

interface ReloadButtonProps {
  className?: string
}

export function ReloadButton({ className }: ReloadButtonProps): React.JSX.Element {
  return (
    <button
      onClick={() => window.location.reload()}
      className={className}
    >
      Try again
    </button>
  )
}

