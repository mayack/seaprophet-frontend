'use client'

import { useFormState } from 'react-dom'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { signIn } from '@/api/sargo/actions/user'
import { FormState } from '@/api/sargo/interfaces/formState'
import { useUser } from '@/contexts/UserContext'

const initialState: FormState = {
  message: '',
  success: false,
}

export function SignInForm() {
  const [state, formAction] = useFormState(signIn, initialState)
  const { toast } = useToast()
  const router = useRouter()
  const { refreshUser } = useUser()

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? 'Success' : 'Error',
        description: state.message,
        variant: state.success ? 'default' : 'destructive',
      })
      if (state.success) {
        refreshUser().then(() => {
          router.push('/')
          router.refresh()
        })
      }
    }
  }, [state, toast, router, refreshUser])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or Username</Label>
        <Input id="identifier" name="identifier" type="text" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <Button type="submit" className="w-full">
        Sign In
      </Button>
    </form>
  )
}
