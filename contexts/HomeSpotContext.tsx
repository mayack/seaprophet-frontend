'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

/** Where set-home mode was launched from — decides whether Settings reopens. */
type EditOrigin = 'settings' | 'map'

/**
 * Bridges the "set home spot" flow. Editing is triggered from Settings (deep
 * inside MapNavigator via UserMenu) but the draggable marker + Cancel/Save
 * overlay live on the single map instance in MapNavigator. This context lets
 * the two talk without prop-drilling through the whole tree.
 */
interface HomeSpotContextValue {
  /** True while the full-screen set-home mode is active. */
  isEditing: boolean
  /**
   * Whether the Settings dialog is open. Owned here (not in UserMenu) because
   * UserMenu unmounts while editing — keeping this in the always-mounted
   * provider is what lets us reliably reopen Settings only for settings-origin
   * edits, without depending on UserMenu's remount timing.
   */
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  /**
   * Enter set-home mode. `origin` defaults to `'settings'` (the settings row);
   * the marker popover passes `'map'` so finishing there doesn't reopen Settings.
   */
  beginEdit: (origin?: EditOrigin) => void
  /** Leave set-home mode (Cancel — discards the draft). */
  cancelEdit: () => void
  /** Leave set-home mode after a successful save. */
  finishEdit: () => void
}

const HomeSpotContext = createContext<HomeSpotContextValue | null>(null)

export function HomeSpotProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const originRef = useRef<EditOrigin>('settings')

  const beginEdit = useCallback((origin: EditOrigin = 'settings') => {
    originRef.current = origin
    // Set-home mode takes over the whole screen — close Settings while editing.
    setSettingsOpen(false)
    setIsEditing(true)
  }, [])

  const exitToSettings = useCallback(() => {
    setIsEditing(false)
    // Only return to Settings when that's where the flow started.
    if (originRef.current === 'settings') {
      setSettingsOpen(true)
    }
  }, [])

  const value = useMemo<HomeSpotContextValue>(
    () => ({
      isEditing,
      settingsOpen,
      setSettingsOpen,
      beginEdit,
      cancelEdit: exitToSettings,
      finishEdit: exitToSettings,
    }),
    [isEditing, settingsOpen, beginEdit, exitToSettings]
  )

  return (
    <HomeSpotContext.Provider value={value}>
      {children}
    </HomeSpotContext.Provider>
  )
}

export function useHomeSpot(): HomeSpotContextValue {
  const context = useContext(HomeSpotContext)
  if (!context) {
    throw new Error('useHomeSpot must be used within HomeSpotProvider')
  }
  return context
}
