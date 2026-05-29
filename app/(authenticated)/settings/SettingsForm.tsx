'use client'

import { useRef, useState, useOptimistic, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Asterisk, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import type { UserSettings } from '@/api/sargo/interfaces/user'
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
} as const

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

export function SettingsForms({
  username: initialUsername,
  email: initialEmail,
  settings: initialSettings,
}: SettingsFormsProps): React.JSX.Element {
  const { setUserData } = useUser()
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [state, optimisticState] = useOptimistic({
    username: initialUsername,
    email: initialEmail,
    settings: initialSettings,
  })
  const [, startTransition] = useTransition()
  // Monotonically increasing id so out-of-order unit-update responses
  // can be discarded and only the latest user intent wins.
  const unitRequestIdRef = useRef(0)

  const handleUsernameSubmit = async (formData: FormData): Promise<void> => {
    startTransition(async () => {
      const newUsername = formData.get('username') as string
      setActiveFormId(null)
      try {
        const result = await updateUsername(formData)
        if (result.success) {
          optimisticState((prev) => ({ ...prev, username: newUsername }))
          setUserData({
            username: newUsername,
            email: state.email,
            settings: state.settings,
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

  const handleUnitChange = async (
    unit: keyof UserSettings['units'],
    value: string
  ): Promise<void> => {
    const previousUnits = state.settings.units
    const newUnits = { ...previousUnits, [unit]: value }
    const newSettings = { ...state.settings, units: newUnits }
    const myRequestId = ++unitRequestIdRef.current

    // Update optimistic state immediately
    startTransition(() => {
      optimisticState((prev) => ({
        ...prev,
        settings: newSettings,
      }))
    })

    try {
      const result = await updateUserSettings(newSettings)

      // Discard stale responses; a newer toggle has already superseded this one.
      if (myRequestId !== unitRequestIdRef.current) return

      if (result.success && result.settings) {
        setUserData({
          username: state.username,
          email: state.email,
          settings: result.settings,
        })
        toast.success('Units updated!')
      } else {
        toast.error(result.error || 'Failed to update settings')
        startTransition(() => {
          optimisticState((prev) => ({
            ...prev,
            settings: { ...prev.settings, units: previousUnits },
          }))
        })
      }
    } catch (error) {
      if (myRequestId !== unitRequestIdRef.current) return

      toast.error(
        error instanceof Error ? error.message : 'Failed to update settings'
      )
      startTransition(() => {
        optimisticState((prev) => ({
          ...prev,
          settings: { ...prev.settings, units: previousUnits },
        }))
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Separator />
        <CollapsibleField
          label="Username"
          value={state.username}
          formId="username"
          activeFormId={activeFormId}
          onFormToggle={setActiveFormId}
        >
          <form action={handleUsernameSubmit} className="space-y-3 pb-2">
            <Input
              id="username"
              name="username"
              defaultValue={state.username}
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
        <Separator />
        <div className="flex items-center">
          <Label htmlFor="units.wind_speed" className="flex-1">
            Wind speed
          </Label>
          <Tabs
            value={state.settings.units.wind_speed}
            onValueChange={(value) => handleUnitChange('wind_speed', value)}
          >
            <TabsList>
              <TabsTrigger value="knots">Kts</TabsTrigger>
              <TabsTrigger value="mph">Mph</TabsTrigger>
              <TabsTrigger value="kph">Kph</TabsTrigger>
              <TabsTrigger value="mps">M/s</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Separator />
        <div className="flex items-center">
          <Label htmlFor="units.surf_height" className="flex-1">
            Surf height
          </Label>
          <Tabs
            value={state.settings.units.surf_height}
            onValueChange={(value) => handleUnitChange('surf_height', value)}
          >
            <TabsList>
              <TabsTrigger value="feet">Feet</TabsTrigger>
              <TabsTrigger value="meters">Meters</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Separator />
        <div className="flex items-center">
          <Label htmlFor="units.swell_height" className="flex-1">
            Swell height
          </Label>
          <Tabs
            value={state.settings.units.swell_height}
            onValueChange={(value) => handleUnitChange('swell_height', value)}
          >
            <TabsList>
              <TabsTrigger value="feet">Feet</TabsTrigger>
              <TabsTrigger value="meters">Meters</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Separator />
        <div className="flex items-center">
          <Label htmlFor="units.tide_height" className="flex-1">
            Tide height
          </Label>
          <Tabs
            value={state.settings.units.tide_height}
            onValueChange={(value) => handleUnitChange('tide_height', value)}
          >
            <TabsList>
              <TabsTrigger value="feet">Feet</TabsTrigger>
              <TabsTrigger value="meters">Meters</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Separator />
        <div className="flex items-center">
          <Label htmlFor="units.temperature" className="flex-1">
            Temperature
          </Label>
          <Tabs
            value={state.settings.units.temperature}
            onValueChange={(value) => handleUnitChange('temperature', value)}
          >
            <TabsList>
              <TabsTrigger value="celsius">Celsius</TabsTrigger>
              <TabsTrigger value="fahrenheit">Fahrenheit</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
