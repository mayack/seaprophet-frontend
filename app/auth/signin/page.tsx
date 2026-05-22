'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { signIn } from '@/api/sargo/actions/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Waves } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import React from 'react'

export default function SignIn(): React.JSX.Element {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  const handleSubmit = async (formData: FormData): Promise<void> => {
    // Synchronous guard against rapid double-submits; isPending from
    // useTransition flips back to false before the async work completes.
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const result = await signIn(formData)
      if (result.success) {
        toast.success('Signed in successfully!')
        startTransition(() => {
          router.push('/')
          router.refresh()
        })
      } else {
        toast.error(result.error || 'Sign-in failed.')
        // eslint-disable-next-line no-console
        console.error('Sign-in error:', result.error)
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('fetch')
          ? 'Check your connection and try again.'
          : 'Sign-in failed unexpectedly.'
      toast.error(message)
      // eslint-disable-next-line no-console
      console.error('Fetch error in signIn:', error)
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="wrapper flex h-full flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-center">
                <Waves className="size-10" />
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
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    name="password"
                    placeholder="Password"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="text-center text-xs text-muted-foreground">
            This app has been deployed only for testing purposes.
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
}
