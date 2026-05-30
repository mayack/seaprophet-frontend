'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Asterisk, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import type { UserSettings } from '@/api/sargo/interfaces/user'
import {
  WIND_SPEED_OPTIONS,
  HEIGHT_OPTIONS,
  TEMPERATURE_OPTIONS,
  type UnitOption,
} from '@/constants/units'
import {
  updateUsername,
  updatePassword,
  updateUserSettings,
} from '@/api/sargo/actions/user'
import { normalizeUserSettings } from '@/lib/userSettings'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'

interface SettingsFormsProps {
  username: string
  settings: UserSettings
}

const MESSAGES = {
  username: 'Username updated!',
  password: 'Password changed!',
  units: 'Units updated',
} as const

// Fixed id so a burst of toggles updates one toast in place instead of
// stacking (sonner dedupes by id). Combined with the `myRequestId`
// stale-request guard — only the latest in-flight save reaches this branch.
const UNITS_TOAST_ID = 'units-updated'

// Coalesce unit toggles into one Sargo write. Long enough to cover a slow
// pass through all five rows (e.g. bottom → top ending on wind speed).
const SAVE_DELAY_MS = 1000

function Dots(): React.JSX.Element {
  return (
    <div className="flex">
      {Array.from({ length: 8 }).map((_, i) => (
        <Asterisk key={i} className="size-3" />
      ))}
    </div>
  )
}

interface CollapsibleFieldProps {
  label: string
  value: React.ReactNode
  formId: string
  activeFormId: string | null
  onFormToggle: (id: string | null) => void
  children: React.ReactNode
}

function CollapsibleField({
  label,
  value,
  formId,
  activeFormId,
  onFormToggle,
  children,
}: CollapsibleFieldProps): React.JSX.Element {
  const isActive = activeFormId === formId
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Label htmlFor={formId} className="w-28">
          {label}
        </Label>
        <div className="flex-1">{value}</div>
        {!isActive && (
          <Button
            onClick={() => onFormToggle(formId)}
            size="sm"
            variant="outline"
          >
            Change
          </Button>
        )}
        {isActive && (
          <div className="flex h-9 flex-col justify-center">
            <button onClick={() => onFormToggle(null)}>
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
      {isActive && children}
    </div>
  )
}

interface UnitSettingProps {
  label: string
  value: string
  options: readonly UnitOption<string>[]
  onChange: (value: string) => void
}

function UnitSetting({
  label,
  value,
  options,
  onChange,
}: UnitSettingProps): React.JSX.Element {
  return (
    <div className="flex items-center">
      <Label className="flex-1">{label}</Label>
      <Tabs value={value} onValueChange={onChange}>
        <TabsList>
          {options.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

const UNIT_SETTINGS = [
  { key: 'wind_speed', label: 'Wind speed', options: WIND_SPEED_OPTIONS },
  { key: 'surf_height', label: 'Surf height', options: HEIGHT_OPTIONS },
  { key: 'swell_height', label: 'Swell height', options: HEIGHT_OPTIONS },
  { key: 'tide_height', label: 'Tide height', options: HEIGHT_OPTIONS },
  { key: 'temperature', label: 'Temperature', options: TEMPERATURE_OPTIONS },
] as const satisfies readonly {
  key: keyof UserSettings['units']
  label: string
  options: readonly UnitOption<string>[]
}[]

export function SettingsForms({
  username: initialUsername,
  settings: initialSettings,
}: SettingsFormsProps): React.JSX.Element {
  const normalizedInitial = normalizeUserSettings(initialSettings)
  const { userData, updateUser } = useUser()
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [username, setUsername] = useState(initialUsername)
  // Tabs render from context (single source of truth for the live UI).
  const units = userData.settings.units
  const camObserverEnabled = normalizeUserSettings(
    userData.settings
  ).camObserverEnabled
  const [isCamObserverSaving, setIsCamObserverSaving] = useState(false)
  // Authoritative working copy of settings, updated synchronously on every
  // toggle so a rapid burst of changes merges correctly. React state
  // snapshots can lag behind a flurry of clicks; a ref never does.
  const workingSettingsRef = useRef<UserSettings>(normalizedInitial)
  // Last settings confirmed persisted by Sargo — the restore target if a
  // save fails.
  const lastSavedSettingsRef = useRef<UserSettings>(normalizedInitial)
  // Debounce timer for the coalesced Sargo write.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped on every toggle so a save that started before newer toggles
  // cannot treat itself as authoritative when it lands.
  const unitRequestIdRef = useRef(0)
  // Only one PUT in flight; further changes queue a follow-up save.
  const saveInFlightRef = useRef(false)
  const saveQueuedRef = useRef(false)
  const runUnitsSaveRef = useRef<() => void>(() => {})

  const handleUsernameSubmit = async (formData: FormData): Promise<void> => {
    startTransition(async () => {
      const newUsername = formData.get('username') as string
      setActiveFormId(null)
      try {
        const result = await updateUsername(formData)
        if (result.success) {
          setUsername(newUsername)
          updateUser({ username: newUsername })
          toast.success(MESSAGES.username)
        } else {
          toast.error(result.error || 'Failed to update username')
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update username'
        )
      }
    })
  }

  const handlePasswordSubmit = async (formData: FormData): Promise<void> => {
    try {
      const result = await updatePassword(formData)
      if (result.success) {
        toast.success(MESSAGES.password)
        setActiveFormId(null)
      } else {
        toast.error(result.error || 'Failed to update password')
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update password'
      )
    }
  }

  // Push a settings snapshot to the synchronous working copy + shared
  // context (the live UI). The single write path for both success and revert.
  const commitSettings = (next: UserSettings): void => {
    workingSettingsRef.current = next
    updateUser({ settings: next })
  }

  // Roll the UI back to the last Sargo-confirmed settings after a failed save.
  const revertUnits = (message: string): void => {
    toast.error(message)
    commitSettings(lastSavedSettingsRef.current)
  }

  const unitsEqual = (
    a: UserSettings['units'],
    b: UserSettings['units']
  ): boolean =>
    (UNIT_SETTINGS as readonly { key: keyof UserSettings['units'] }[]).every(
      ({ key }) => a[key] === b[key]
    )

  // Persist working settings. Serialized so an older in-flight PUT cannot
  // land after a newer one and clobber units the user already changed.
  const runUnitsSave = (): void => {
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
    // Read + normalize at send time so wind (often changed last) is included.
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
        toast.success(MESSAGES.units, { id: UNITS_TOAST_ID })
      })
      .catch((error) => {
        if (myRequestId !== unitRequestIdRef.current) return
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
          runUnitsSave()
        }
      })
  }

  runUnitsSaveRef.current = runUnitsSave

  useEffect(() => {
    return (): void => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
        runUnitsSaveRef.current()
      }
    }
  }, [])

  const handleUnitChange = (
    unit: keyof UserSettings['units'],
    value: string
  ): void => {
    // Merge onto the synchronous working copy so every toggle in a burst
    // builds on the previous one instead of off a stale React snapshot —
    // that stale-base race is why bulk changes used to lose writes.
    const newSettings = normalizeUserSettings({
      ...workingSettingsRef.current,
      units: { ...workingSettingsRef.current.units, [unit]: value },
    })
    unitRequestIdRef.current += 1

    // Instant UI via shared context; coalesce the network write after.
    commitSettings(newSettings)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(runUnitsSave, SAVE_DELAY_MS)
  }

  const handleCamObserverChange = (enabled: boolean): void => {
    const previous = workingSettingsRef.current
    const newSettings = normalizeUserSettings({
      ...workingSettingsRef.current,
      camObserverEnabled: enabled,
    })

    commitSettings(newSettings)
    setIsCamObserverSaving(true)

    updateUserSettings(newSettings)
      .then((result) => {
        if (!result.success) {
          commitSettings(previous)
          toast.error(result.error || 'Settings could not be saved')
          return
        }

        const persisted = normalizeUserSettings(
          result.settings ?? newSettings
        )
        lastSavedSettingsRef.current = persisted
        commitSettings(persisted)
        toast.success(
          enabled ? 'Cam Observer enabled' : 'Cam Observer disabled'
        )
      })
      .catch((error) => {
        commitSettings(previous)
        toast.error(
          error instanceof Error ? error.message : 'Settings could not be saved'
        )
      })
      .finally(() => {
        setIsCamObserverSaving(false)
      })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Separator />
        <CollapsibleField
          label="Username"
          value={username}
          formId="username"
          activeFormId={activeFormId}
          onFormToggle={setActiveFormId}
        >
          <form action={handleUsernameSubmit} className="space-y-3 pb-2">
            <Input
              id="username"
              name="username"
              defaultValue={username}
              placeholder="Your username"
            />
            <Button type="submit">Update username</Button>
          </form>
        </CollapsibleField>
        <Separator />
        <CollapsibleField
          label="Password"
          value={<Dots />}
          formId="password"
          activeFormId={activeFormId}
          onFormToggle={setActiveFormId}
        >
          <form action={handlePasswordSubmit} className="space-y-3 pb-2">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="Current password"
            />
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="New password"
            />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
            />
            <Button type="submit">Update password</Button>
          </form>
        </CollapsibleField>
      </div>
      <div className="space-y-4">
        {UNIT_SETTINGS.map(({ key, label, options }) => (
          <div key={key} className="space-y-4">
            <Separator />
            <UnitSetting
              label={label}
              value={units[key]}
              options={options}
              onChange={(value) => handleUnitChange(key, value)}
            />
          </div>
        ))}
        {userData.calibrationReporter ? (
          <div className="space-y-4">
            <Separator />
            <div className="flex items-center">
              <Label htmlFor="cam-observer" className="flex-1">
                Cam Observer
              </Label>
              <Switch
                id="cam-observer"
                checked={camObserverEnabled}
                disabled={isCamObserverSaving}
                onCheckedChange={handleCamObserverChange}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
