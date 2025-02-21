import { signIn } from '@/api/sargo/actions/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Waves } from 'lucide-react'

export default function SignIn() {
  return (
    <div className="flex flex-col gap-12 min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-center"><Waves className="w-10 h-10" /></CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                name="identifier"
                placeholder="Email address"
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                name="password"
                placeholder="Password"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground text-xs">This app has been deployed only for testing purposes.</div>
    </div>
  )
}
