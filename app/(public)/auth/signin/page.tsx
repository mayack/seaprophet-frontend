'use client'

import { useActionState, useEffect } from 'react'
import { signIn, type SignInState } from '@/api/sargo/actions/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Waves } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SignIn(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    signIn,
    null
  )
  const isRedirecting = Boolean(state?.success)

  useEffect(() => {
    if (!state?.success) return
    window.location.replace('/')
  }, [state?.success])

  return (
    <div className="wrapper flex h-full flex-col items-center justify-center py-6 box-border">
      <div className="w-full max-w-sm space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-center">
              <Waves className="size-10" aria-hidden />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={formAction}
              className="space-y-4"
              aria-busy={isPending}
            >
              <div className="space-y-2">
                <Input
                  type="text"
                  name="identifier"
                  placeholder="Email or username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  disabled={isPending || isRedirecting}
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  name="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  disabled={isPending || isRedirecting}
                />
              </div>
              {state?.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}
              <button
                type="submit"
                disabled={isPending || isRedirecting}
                aria-live="polite"
                className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
              >
                {isPending || isRedirecting ? (
                  <>
                    <Spinner />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          This app has been deployed only for testing purposes.
        </p>
      </div>
    </div>
  )
}
