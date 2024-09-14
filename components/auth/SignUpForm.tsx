'use client'

import { useFormState } from 'react-dom'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { signUp } from '@/api/sargo/actions/user'
import { FormState } from '@/api/sargo/interfaces/formState'

const initialState: FormState = {
  message: '',
  success: false,
}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUp, initialState)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? 'Success' : 'Error',
        description: state.message,
        variant: state.success ? 'default' : 'destructive',
      })
      if (state.success) {
        router.push('/')
        router.refresh()
      }
    }
  }, [state, toast, router])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" type="text" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <Button type="submit" className="w-full">
        Sign Up
      </Button>
    </form>
  )
}
