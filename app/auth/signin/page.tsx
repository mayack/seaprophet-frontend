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
      try {
        const result = await signIn(formData)
        if (result.success) {
          toast.success('Signed in successfully!')
          router.push('/')
          router.refresh()
        } else {
          toast.error(result.error || 'Sign-in failed.')
          console.error('Sign-in error:', result.error)
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message.includes('fetch')
            ? 'Check your connection and try again.'
            : 'Sign-in failed unexpectedly.'
        toast.error(message)
        console.error('Fetch error in signIn:', error)
      }
    })
  }

  return (
    <div className="wrapper flex h-full flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-8">
        <Toaster />
        <Card className="">
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
                  placeholder="Email or username"
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
                {isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="text-center text-xs text-muted-foreground">
          This app has been deployed only for testing purposes.
        </div>
      </div>
    </div>
  )
}
