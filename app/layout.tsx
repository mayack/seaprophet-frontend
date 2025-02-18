import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { Toaster } from '@/components/ui/toaster'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { UserProvider } from '@/contexts/UserContext'
import { User } from '@/api/sargo/interfaces/user'
import { UserMenu } from '@/components/common/UserMenu'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
})

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialUser = await getCurrentUser()
  return (
    <html lang="en" className={'min-h-full h-full ' + inter.variable}>
      <body className="min-h-full h-full flex flex-col">
        <UserProvider initialUser={initialUser}>
          {initialUser && <NavBar initialUser={initialUser} />}
          <main className="flex-1 flex items-center justify-center w-full">
            {children}
          </main>
          <Toaster />
        </UserProvider>
      </body>
    </html>
  )
}
