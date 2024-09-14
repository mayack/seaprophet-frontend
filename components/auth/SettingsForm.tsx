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

const initialState: FormState = {
  message: '',
  success: false,
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
        <Label htmlFor="unitSystem">Unit System</Label>
        <Select
          name="unitSystem"
          defaultValue={user.settings?.unit_system || 'metric'}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select unit system" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="metric">Metric</SelectItem>
            <SelectItem value="imperial">Imperial</SelectItem>
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
