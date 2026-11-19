'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth-shell'
import { authClient } from '@/lib/auth-client'

export default function Page() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.requestPasswordReset(email)
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            {sent ? 'If an account exists for that email, a reset link is on its way.' : "Enter your email and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground" role="status">
              Check <strong className="text-foreground">{email}</strong> (and spam). The link works once and expires in an hour.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 text-base" />
              </div>
              {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send reset link
              </Button>
            </form>
          )}
          <div className="mt-4 text-center text-sm">
            <Link href="/auth/login" className="underline underline-offset-4 inline-block py-2">Back to sign in</Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
