export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Header } from '@/components/common/Header'
import { redirect } from 'next/navigation'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userToken = await getCurrentUser()

  if (!userToken) {
    redirect('/auth/signin')
  }

  const { user } = userToken

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header user={user} />
      <main className="flex-1 py-12">{children}</main>
    </div>
  )
}
