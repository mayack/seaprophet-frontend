'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { TabsRadioGroup } from '@/components/common/TabsRadioGroup'
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
  updateUnits,
} from '@/api/sargo/actions/user'

interface SettingsFormsProps {
  username: string
  email: string
  settings: UserSettings
}

const MESSAGES = {
  username: 'Username updated successfully!',
  password: 'Password changed successfully!',
} as const

function Dots() {
  return (
    <div className="flex">
      {Array.from({ length: 8 }).map((_, i) => (
        <Asterisk key={i} className="h-3 w-3" />
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
}: CollapsibleFieldProps) {
  const isActive = activeFormId === formId

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Label htmlFor={formId} className="w-40">
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
              <X className="h-4 w-4" />
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
}: SettingsFormsProps) {
  const { setUserData } = useUser()
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [state, optimisticState] = useOptimistic({
    username: initialUsername,
    email: initialEmail,
    settings: initialSettings,
  })
  const [, startTransition] = useTransition()

  const handleUsernameSubmit = async (formData: FormData) => {
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
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update username'
        )
      }
    })
  }

  const handlePasswordSubmit = async (formData: FormData) => {
    try {
      const result = await updatePassword(formData)
      if (result.success) {
        toast.success(MESSAGES.password)
        setActiveFormId(null)
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
  ) => {
    startTransition(async () => {
      const newUnits = {
        ...state.settings.units,
        [unit]: value,
      }

      optimisticState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          units: newUnits,
        },
      }))

      const formData = new FormData()
      Object.entries(newUnits).forEach(([key, value]) => {
        formData.append(`units.${key}`, value)
      })

      try {
        const result = await updateUnits(formData)
        if (result.success && result.units) {
          setUserData({
            username: state.username,
            email: state.email,
            settings: { units: result.units },
          })
        } else {
          toast.error('Failed to update settings')
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update settings'
        )
      }
    })
  }

  return (
    <>
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
          <TabsRadioGroup
            name="units.wind_speed"
            defaultValue={state.settings?.units?.wind_speed || 'knots'}
            onValueChange={(value) => handleUnitChange('wind_speed', value)}
            options={[
              { value: 'knots', label: 'Knots' },
              { value: 'mph', label: 'Mph' },
              { value: 'kph', label: 'Kph' },
              { value: 'mps', label: 'M/s' },
            ]}
          />
        </div>

        <Separator />

        <div className="flex items-center">
          <Label htmlFor="units.surf_height" className="flex-1">
            Surf height
          </Label>
          <TabsRadioGroup
            name="units.surf_height"
            defaultValue={state.settings?.units?.surf_height || 'feet'}
            onValueChange={(value) => handleUnitChange('surf_height', value)}
            options={[
              { value: 'feet', label: 'Feet' },
              { value: 'meters', label: 'Meters' },
            ]}
          />
        </div>

        <Separator />

        <div className="flex items-center">
          <Label htmlFor="units.swell_height" className="flex-1">
            Swell height
          </Label>
          <TabsRadioGroup
            name="units.swell_height"
            defaultValue={state.settings?.units?.swell_height || 'feet'}
            onValueChange={(value) => handleUnitChange('swell_height', value)}
            options={[
              { value: 'feet', label: 'Feet' },
              { value: 'meters', label: 'Meters' },
            ]}
          />
        </div>

        <Separator />

        <div className="flex items-center">
          <Label htmlFor="units.tide_height" className="flex-1">
            Tide height
          </Label>
          <TabsRadioGroup
            name="units.tide_height"
            defaultValue={state.settings?.units?.tide_height || 'feet'}
            onValueChange={(value) => handleUnitChange('tide_height', value)}
            options={[
              { value: 'feet', label: 'Feet' },
              { value: 'meters', label: 'Meters' },
            ]}
          />
        </div>

        <Separator />

        <div className="flex items-center">
          <Label htmlFor="units.temperature" className="flex-1">
            Temperature
          </Label>
          <TabsRadioGroup
            name="units.temperature"
            defaultValue={state.settings?.units?.temperature || 'celsius'}
            onValueChange={(value) => handleUnitChange('temperature', value)}
            options={[
              { value: 'celsius', label: 'Celsius' },
              { value: 'fahrenheit', label: 'Fahrenheit' },
            ]}
          />
        </div>
      </div>
    </>
  )
}
