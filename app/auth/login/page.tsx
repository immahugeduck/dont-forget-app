'use client'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { AuthShell } from '@/components/auth-shell'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          setUnconfirmed(true)
          throw new Error('Please confirm your email first. Check your inbox for the link.')
        }
        throw new Error(/invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message)
      }
      router.push('/')
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const resend = async () => {
    const { error } = await authClient.resendConfirmation(email)
    setResent(error ? error.message : 'Confirmation email sent. Check your inbox.')
  }

  return (
    <AuthShell>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Sign in to sync your planner across devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      autoComplete="email"
                      inputMode="email"
                      className="h-11 text-base"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="h-11 text-base"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
                  {unconfirmed && (
                    <Button type="button" variant="secondary" className="w-full h-11" onClick={() => void resend()}>
                      Resend confirmation email
                    </Button>
                  )}
                  {resent && <p className="text-sm text-muted-foreground" role="status">{resent}</p>}
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>
                </div>
                <div className="mt-3 text-center text-sm">
                  <Link href="/auth/forgot-password" className="underline underline-offset-4 inline-block py-2">
                    Forgot password?
                  </Link>
                </div>
                <div className="mt-1 text-center text-sm">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/auth/sign-up"
                    className="underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
    </AuthShell>
  )
}
