'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUser } from '@/contexts/UserContext'
import { SettingsForms } from '@/app/(authenticated)/settings/SettingsForm'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Settings as a centered modal, opened from the user menu. A lightweight custom
 * dialog (backdrop + card + Esc), matching the app's other custom overlays
 * (SpotBox) rather than pulling in a dialog dependency. Reads user data from
 * context, so no server fetch is needed — the same SettingsForms the /settings
 * page uses is reused here.
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: SettingsDialogProps): React.JSX.Element | null {
  const { userData } = useUser()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b p-4">
          <h2 className="font-style-h2">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close settings"
          >
            <X />
          </Button>
        </div>
        <div className="overflow-y-auto p-4">
          <SettingsForms
            username={userData.username}
            settings={userData.settings}
          />
        </div>
      </div>
    </div>
  )
}
