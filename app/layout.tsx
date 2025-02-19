import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={'min-h-full h-full ' + inter.variable}>
      <body className="min-h-full h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
