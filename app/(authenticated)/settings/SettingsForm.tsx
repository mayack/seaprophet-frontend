'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SettingsFormsProps {
  username: string
  email: string
  settings: UserSettings
}

const MESSAGES = {
  username: 'Username updated!',
  password: 'Password changed!',
  units: 'Units updated',
} as const

// Coalesce a burst of unit toggles into a single Sargo write. Long enough
// to batch a "change all five" flurry, short enough to feel immediate.
const SAVE_DELAY_MS = 600

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
  email: initialEmail,
  settings: initialSettings,
}: SettingsFormsProps): React.JSX.Element {
  const router = useRouter()
  const { userData, setUserData } = useUser()
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [username, setUsername] = useState(initialUsername)
  const [units, setUnits] = useState<UserSettings['units']>(
    initialSettings.units
  )
  // Authoritative working copy of settings, updated synchronously on every
  // toggle so a rapid burst of changes merges correctly. React state
  // snapshots can lag behind a flurry of clicks; a ref never does.
  const workingSettingsRef = useRef<UserSettings>(initialSettings)
  // Last settings confirmed persisted by Sargo — the restore target if a
  // save fails.
  const lastSavedSettingsRef = useRef<UserSettings>(initialSettings)
  // Debounce timer for the coalesced Sargo write.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonically increasing id so out-of-order save failures only revert
  // if no newer change has superseded them.
  const unitRequestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleUsernameSubmit = async (formData: FormData): Promise<void> => {
    startTransition(async () => {
      const newUsername = formData.get('username') as string
      setActiveFormId(null)
      try {
        const result = await updateUsername(formData)
        if (result.success) {
          setUsername(newUsername)
          setUserData({
            username: newUsername,
            email: initialEmail,
            settings: workingSettingsRef.current,
          })
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

  // Restore the UI + context to the last settings Sargo confirmed, used
  // when a coalesced save fails.
  const revertUnits = (message: string): void => {
    toast.error(message)
    const restored = lastSavedSettingsRef.current
    workingSettingsRef.current = restored
    setUnits(restored.units)
    setUserData({
      username: userData.username,
      email: userData.email,
      settings: restored,
    })
  }

  // Persist the accumulated working settings as a single write. Runs once
  // per debounce window, so a "change all five" burst is one PUT + one
  // refresh instead of five racing server actions.
  const persistUnits = (): void => {
    const settingsToSave = workingSettingsRef.current
    const myRequestId = ++unitRequestIdRef.current

    updateUserSettings(settingsToSave)
      .then((result) => {
        if (myRequestId !== unitRequestIdRef.current) return

        if (!result.success) {
          revertUnits(result.error || 'Settings could not be saved')
          return
        }

        lastSavedSettingsRef.current = settingsToSave
        toast.success(MESSAGES.units)

        // Re-run server components (e.g. an open spot page) so the
        // forecast is refetched from Polvo with the new units — values
        // are converted server-side, so without this the numbers and
        // their labels would disagree until a manual reload.
        router.refresh()
      })
      .catch((error) => {
        if (myRequestId !== unitRequestIdRef.current) return
        revertUnits(
          error instanceof Error ? error.message : 'Settings could not be saved'
        )
      })
  }

  const handleUnitChange = (
    unit: keyof UserSettings['units'],
    value: string
  ): void => {
    // Merge onto the synchronous working copy so every toggle in a burst
    // builds on the previous one instead of off a stale React snapshot —
    // that stale-base race is why bulk changes used to lose writes.
    const newUnits = { ...workingSettingsRef.current.units, [unit]: value }
    const newSettings = { ...workingSettingsRef.current, units: newUnits }
    workingSettingsRef.current = newSettings

    // Instant UI: local tab state + shared context for the rest of the app.
    setUnits(newSettings.units)
    setUserData({
      username: userData.username,
      email: userData.email,
      settings: newSettings,
    })

    // Coalesce the network write. One PUT to Sargo + one router.refresh()
    // per burst; this also avoids queuing several server actions, which
    // is what blocked navigation while a bulk change was in flight.
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(persistUnits, SAVE_DELAY_MS)
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
      </div>
    </div>
  )
}
