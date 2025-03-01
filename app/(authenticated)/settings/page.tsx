import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Toaster } from 'sonner'
import { SettingsForms } from './SettingsForm'

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    return <div>Please sign in to access settings</div>
  }

  return (
    <>
      <div className="wrapper max-w-lg">
        <h1 className="font-style-h2 mb-6">Settings</h1>
        <SettingsForms
          username={user.username}
          email={user.email}
          settings={user.settings}
        />
      </div>
      <Toaster />
    </>
  )
}
