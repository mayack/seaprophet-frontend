'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation' // Add this
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { signIn } from '@/api/sargo/actions/user'
import { FormState } from '@/api/sargo/interfaces/formState'
import { useUser } from '@/contexts/UserContext'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign In'}
    </Button>
  )
}

const initialState: FormState = {
  message: '',
  success: false,
}

export function SignInForm() {
  const [state, formAction] = useFormState(signIn, initialState)
  const { toast } = useToast()
  const { refreshUser } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter() // Add this

  const handleFormAction = async (formData: FormData) => {
    setIsLoading(true)
    return formAction(formData)
  }

  useEffect(() => {
    if (state.success) {
      refreshUser()
      router.replace('/') // Add this
      toast({
        title: 'Success',
        description: state.message,
        variant: 'default',
      })
    } else if (state.message) {
      setIsLoading(false)
      toast({
        title: 'Error',
        description: state.message,
        variant: 'destructive',
      })
    }
  }, [state, toast, refreshUser, router]) // Add router to deps

  if (isLoading) return null

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-5xl font-bold mb-12">
        This site exists only for testing purposes.
      </h1>
      <form action={handleFormAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or Username</Label>
          <Input id="identifier" name="identifier" type="text" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <SubmitButton />
      </form>
    </div>
  )
}
