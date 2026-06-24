'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { UserSettings } from '@/api/sargo/interfaces/user'
import { updateUserSettings } from '@/api/sargo/actions/user'
import { recoverFromDeploySkew } from '@/lib/recoverFromDeploySkew'
import {
  normalizeUserSettings,
  type NormalizedUserSettings,
} from '@/lib/userSettings'

const UNITS_TOAST_ID = 'units-updated'
const SAVE_DELAY_MS = 1000

const UNIT_KEYS = [
  'wind_speed',
  'surf_height',
  'swell_height',
  'tide_height',
  'temperature',
] as const satisfies readonly (keyof UserSettings['units'])[]

function unitsEqual(
  a: UserSettings['units'],
  b: UserSettings['units']
): boolean {
  return UNIT_KEYS.every((key) => a[key] === b[key])
}

export function useDebouncedSettingsSave(
  initialSettings: NormalizedUserSettings,
  updateUser: (patch: { settings: NormalizedUserSettings }) => void
): {
  handleUnitChange: (unit: keyof UserSettings['units'], value: string) => void
  commitSettings: (next: NormalizedUserSettings) => void
  getWorkingSettings: () => NormalizedUserSettings
  syncPersistedSettings: (settings: NormalizedUserSettings) => void
} {
  const workingSettingsRef = useRef(initialSettings)
  const lastSavedSettingsRef = useRef(initialSettings)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unitRequestIdRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const saveQueuedRef = useRef(false)
  const runUnitsSaveRef = useRef<() => void>(() => {})

  const commitSettings = useCallback(
    (next: NormalizedUserSettings): void => {
      workingSettingsRef.current = next
      updateUser({ settings: next })
    },
    [updateUser]
  )

  const revertUnits = useCallback(
    (message: string): void => {
      toast.error(message)
      commitSettings(lastSavedSettingsRef.current)
    },
    [commitSettings]
  )

  const runUnitsSave = useCallback((): void => {
    if (
      unitsEqual(
        workingSettingsRef.current.units,
        lastSavedSettingsRef.current.units
      )
    ) {
      return
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true
      return
    }

    const myRequestId = unitRequestIdRef.current
    saveInFlightRef.current = true
    const settingsToSave = normalizeUserSettings(workingSettingsRef.current)

    updateUserSettings(settingsToSave)
      .then((result) => {
        if (myRequestId !== unitRequestIdRef.current) return

        if (!result.success) {
          revertUnits(result.error || 'Settings could not be saved')
          return
        }

        const persisted = normalizeUserSettings(
          result.settings ?? settingsToSave
        )
        lastSavedSettingsRef.current = persisted
        commitSettings(persisted)
        toast.success('Units updated', { id: UNITS_TOAST_ID })
      })
      .catch((error) => {
        if (myRequestId !== unitRequestIdRef.current) return
        if (recoverFromDeploySkew(error)) return
        revertUnits(
          error instanceof Error ? error.message : 'Settings could not be saved'
        )
      })
      .finally(() => {
        saveInFlightRef.current = false
        const stillDirty = !unitsEqual(
          workingSettingsRef.current.units,
          lastSavedSettingsRef.current.units
        )
        if (saveQueuedRef.current || stillDirty) {
          saveQueuedRef.current = false
          // Drain via the ref to avoid referencing this callback before it's
          // declared; the ref always points at the latest runUnitsSave.
          runUnitsSaveRef.current?.()
        }
      })
  }, [commitSettings, revertUnits])

  useEffect(() => {
    runUnitsSaveRef.current = runUnitsSave
  })

  // Intentionally NO effect resyncing the refs from `initialSettings`.
  //
  // `initialSettings` is `normalizeUserSettings(userData.settings)`, recomputed
  // with a fresh object identity on every render — and `userData.settings` is
  // what THIS hook mutates optimistically via commitSettings. So an effect
  // keyed on `initialSettings` fires after every optimistic change and would
  // reset `lastSavedSettingsRef` ("what the server confirmed") to the value the
  // user just picked. runUnitsSave's dirty check (unitsEqual working vs saved)
  // would then see them equal and skip the save entirely — units silently never
  // persist. The lazy useRef init above already seeds both refs, and the form
  // remounts on each dialog open (SettingsDialog gates with `open ? ... : null`),
  // so a resync effect is unnecessary as well as harmful. Don't reintroduce it.

  useEffect(() => {
    return (): void => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
        runUnitsSaveRef.current()
      }
    }
  }, [])

  const handleUnitChange = useCallback(
    (unit: keyof UserSettings['units'], value: string): void => {
      const newSettings = normalizeUserSettings({
        ...workingSettingsRef.current,
        units: { ...workingSettingsRef.current.units, [unit]: value },
      })
      unitRequestIdRef.current += 1
      commitSettings(newSettings)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(runUnitsSave, SAVE_DELAY_MS)
    },
    [commitSettings, runUnitsSave]
  )

  return {
    handleUnitChange,
    commitSettings,
    getWorkingSettings: (): NormalizedUserSettings =>
      workingSettingsRef.current,
    syncPersistedSettings: (settings: NormalizedUserSettings): void => {
      lastSavedSettingsRef.current = settings
      workingSettingsRef.current = settings
    },
  }
}
