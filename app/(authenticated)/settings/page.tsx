import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from 'sonner'
import { SettingsForms } from './SettingsForm'

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    return <div>Please sign in to access settings</div>
  }

  return (
    <>
      <div className="wrapper mx-auto max-w-lg">
        <div>
          <h1 className="font-style-h2 mb-6">Settings</h1>
          <SettingsForms
            username={user.username}
            email={user.email}
            settings={user.settings}
          />
        </div>
      </div>
      <Toaster />
    </>
  )
}
