import { SettingsForm } from '@/components/auth/SettingsForm'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">User Settings</h1>
      <SettingsForm />
    </div>
  )
}
