import { SignInForm } from '@/components/auth/SignInForm'
// import { getCurrentUser } from '@/api/sargo/actions/user'
// import { redirect } from 'next/navigation'

export default async function SignInPage() {
  // const user = await getCurrentUser()

  // if (user) {
  //   redirect('/')
  // }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>
      <SignInForm />
    </div>
  )
}
