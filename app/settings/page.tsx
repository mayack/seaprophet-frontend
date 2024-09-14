import { SettingsForm } from '@/components/auth/SettingsForm'

export default function SettingsPage() {
  return (
    <div className="container max-w-2xl py-12">
      <h1 className="text-3xl font-bold mb-6">User Settings</h1>
      <SettingsForm />
    </div>
  )
}
