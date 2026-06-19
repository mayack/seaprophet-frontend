'use client'

import React from 'react'
import { SettingsForm } from '@/components/common/SettingsForm'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
}: SettingsDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100%-2rem))] gap-0 overflow-hidden p-0 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-black/40 after:opacity-0 after:transition-opacity after:duration-150 after:content-[''] data-[nested-dialog-open]:after:opacity-100 sm:max-w-[min(42rem,90vw)]">
        {open ? <SettingsForm /> : null}
      </DialogContent>
    </Dialog>
  )
}
