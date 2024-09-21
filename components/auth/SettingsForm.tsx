'use client'

import { useFormState } from 'react-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import { updateUserSettings } from '@/api/sargo/actions/user'
import { FormState } from '@/api/sargo/interfaces/formState'
import { useUser } from '@/contexts/UserContext'
import { UserUnits } from '@/api/sargo/interfaces/user'

const initialState: FormState = {
  message: '',
  success: false,
}

const defaultUnits: UserUnits = {
  wind_speed: 'knots',
  surf_height: 'feet',
  swell_height: 'feet',
  tide_height: 'feet',
  temperature: 'celsius',
}

export function SettingsForm() {
  const { user, refreshUser } = useUser()
  const [state, formAction] = useFormState(updateUserSettings, initialState)
  const { toast } = useToast()
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? 'Success' : 'Error',
        description: state.message,
        variant: state.success ? 'default' : 'destructive',
      })
      if (state.success) {
        refreshUser()
      }
    }
  }, [state, toast, refreshUser])

  if (!user) {
    return <div>Loading user data...</div>
  }

  const units = user.settings?.units || defaultUnits

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" defaultValue={user.username} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={user.email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="units.wind_speed">Wind Speed</Label>
        <Select name="units.wind_speed" defaultValue={units.wind_speed}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select wind speed unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="knots">Knots</SelectItem>
            <SelectItem value="mph">Miles per hour (mph)</SelectItem>
            <SelectItem value="kph">Kilometers per hour (kph)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="units.surf_height">Surf Height</Label>
        <Select name="units.surf_height" defaultValue={units.surf_height}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select surf height unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feet">Feet</SelectItem>
            <SelectItem value="meters">Meters</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="units.swell_height">Swell Height</Label>
        <Select name="units.swell_height" defaultValue={units.swell_height}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select swell height unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feet">Feet</SelectItem>
            <SelectItem value="meters">Meters</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="units.tide_height">Tide Height</Label>
        <Select name="units.tide_height" defaultValue={units.tide_height}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select tide height unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feet">Feet</SelectItem>
            <SelectItem value="meters">Meters</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="units.temperature">Temperature</Label>
        <Select name="units.temperature" defaultValue={units.temperature}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select temperature unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="celsius">Celsius</SelectItem>
            <SelectItem value="fahrenheit">Fahrenheit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Button
          type="button"
          onClick={() => setIsChangingPassword(!isChangingPassword)}
        >
          {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
        </Button>
      </div>
      {isChangingPassword && (
        <>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
            />
          </div>
        </>
      )}
      <Button type="submit">Save Settings</Button>
    </form>
  )
}
