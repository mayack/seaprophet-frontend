// app/auth/signin/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { signIn } from '@/api/sargo/actions/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Waves } from 'lucide-react'
import { toast, Toaster } from 'sonner'

export default function SignIn() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await signIn(formData)
      if (result.success) {
        toast.success('Signed in successfully!')
        router.push('/')
        router.refresh()
      } else {
        toast.error(result.error || 'Sign-in failed')
        console.error('Sign-in error:', result.error)
      }
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12">
      <Toaster /> {/* Added Toaster component */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-center">
            <Waves className="h-10 w-10" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                name="identifier"
                placeholder="Email address"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                name="password"
                placeholder="Password"
                required
                disabled={isPending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground">
        This app has been deployed only for testing purposes.
      </div>
    </div>
  )
}
