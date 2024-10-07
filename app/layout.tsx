import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Toaster } from '@/components/ui/toaster'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { UserProvider } from '@/contexts/UserContext'
import { User } from '@/api/sargo/interfaces/user'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '600', '700'],
})

function NavBar({ initialUser }: { initialUser: User | null }) {
  return (
    <nav className="bg-gray-100 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Sea Prophet
        </Link>
        <div className="space-x-4">
          {initialUser ? (
            <>
              <span>Welcome, {initialUser.username}!</span>
              <Link href="/settings" className="text-blue-500 hover:underline">
                Settings
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/auth/signup"
                className="text-blue-500 hover:underline"
              >
                Sign Up
              </Link>
              <Link
                href="/auth/signin"
                className="text-blue-500 hover:underline"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialUser = await getCurrentUser()

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <UserProvider initialUser={initialUser}>
          <NavBar initialUser={initialUser} />
          <main className="container mx-auto mt-8">{children}</main>
          <Toaster />
        </UserProvider>
      </body>
    </html>
  )
}
