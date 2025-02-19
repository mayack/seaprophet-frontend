import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { UserProvider } from '@/contexts/UserContext'
import { User } from '@/api/sargo/interfaces/user'
import { UserMenu } from '@/components/common/UserMenu'
import Link from 'next/link'

function NavBar({ initialUser }: { initialUser: User | null }) {
  return (
    <nav className="p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Sea Prophet
        </Link>
        {initialUser && <UserMenu user={initialUser} />}
      </div>
    </nav>
  )
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialUser = await getCurrentUser()

  if (!initialUser) {
    redirect('/auth/signin')
  }

  return (
    <UserProvider initialUser={initialUser}>
      <NavBar initialUser={initialUser} />
      <main className="flex-1 flex w-full">{children}</main>
    </UserProvider>
  )
}
