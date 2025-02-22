export const dynamic = 'force-dynamic'

import { getCurrentUser, updateSettings } from '@/api/sargo/actions/auth'
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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  // Force re-fetch by disabling cache for this page
  const userToken = await getCurrentUser()

  if (!userToken) {
    return <div>Please sign in to access settings</div>
  }

  const { user } = userToken
  const params = await searchParams
  const success = params.success === 'true'

  return (
    <div className="container">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      {success && (
        <p className="mb-4 text-green-600">Settings updated successfully!</p>
      )}

      <form action={updateSettings} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            defaultValue={user.username || ''}
            placeholder="Your username"
          />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium">Units</legend>
          <div className="space-y-2">
            <Label htmlFor="units.wind_speed">Wind Speed</Label>
            <Select
              name="units.wind_speed"
              defaultValue={user.settings?.units?.wind_speed || 'knots'}
            >
              <SelectTrigger id="units.wind_speed">
                <SelectValue placeholder="Select wind speed unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="knots">Knots</SelectItem>
                <SelectItem value="mph">Miles per Hour (mph)</SelectItem>
                <SelectItem value="kph">Kilometers per Hour (kph)</SelectItem>
                <SelectItem value="mps">Meters per Second (mps)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="units.surf_height">Surf Height</Label>
            <Select
              name="units.surf_height"
              defaultValue={user.settings?.units?.surf_height || 'feet'}
            >
              <SelectTrigger id="units.surf_height">
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
            <Select
              name="units.swell_height"
              defaultValue={user.settings?.units?.swell_height || 'feet'}
            >
              <SelectTrigger id="units.swell_height">
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
            <Select
              name="units.tide_height"
              defaultValue={user.settings?.units?.tide_height || 'feet'}
            >
              <SelectTrigger id="units.tide_height">
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
            <Select
              name="units.temperature"
              defaultValue={user.settings?.units?.temperature || 'celsius'}
            >
              <SelectTrigger id="units.temperature">
                <SelectValue placeholder="Select temperature unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="celsius">Celsius</SelectItem>
                <SelectItem value="fahrenheit">Fahrenheit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium">Change Password</legend>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="Current password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="New password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
            />
          </div>
        </fieldset>

        <Button type="submit" className="w-full">
          Save Settings
        </Button>
      </form>
    </div>
  )
}
