import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from 'sonner'
import { SettingsForms } from './SettingsForm'

export default async function SettingsPage() {
  const userToken = await getCurrentUser()

  if (!userToken) {
    return <div>Please sign in to access settings</div>
  }

  const { user } = userToken

  return (
    <div className="container max-w-2xl">
      <Toaster />
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsForms username={user.username} settings={user.settings} />
        </CardContent>
      </Card>
    </div>
  )
}
