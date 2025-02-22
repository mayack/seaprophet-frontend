export const dynamic = 'auto' // Default behavior, respects caching
export const revalidate = 300 // Cache for 5 minutes, adjust as needed

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Header } from '@/components/common/Header'
import { redirect } from 'next/navigation'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.time('AuthenticatedLayout')
  const userToken = await getCurrentUser()

  if (!userToken) {
    redirect('/auth/signin')
  }

  const { user } = userToken

  const layout = (
    <div className="flex min-h-screen flex-col bg-background">
      <Header user={user} />
      <main className="flex-1 py-12">{children}</main>
    </div>
  )
  console.timeEnd('AuthenticatedLayout')
  return layout
}
