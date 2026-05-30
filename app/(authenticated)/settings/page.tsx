import { getCurrentUser } from '@/api/sargo/actions/auth'
import { SettingsForms } from './SettingsForm'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  return (
    <div className="wrapper mobile-safe-bottom max-w-lg py-4 sm:py-6 xl:py-8">
      <h1 className="font-style-h2 mb-6">Settings</h1>
      <SettingsForms username={user.username} settings={user.settings} />
    </div>
  )
}
