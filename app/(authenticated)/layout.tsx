export const revalidate = 900

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Header } from '@/components/common/Header'
import { UserProvider } from '@/contexts/UserContext'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userData = await getCurrentUser()

  return (
    <UserProvider initialUserData={userData.user}>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-12">{children}</main>
      </div>
    </UserProvider>
  )
}
