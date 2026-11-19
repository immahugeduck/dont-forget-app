'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth-shell'
import { authClient } from '@/lib/auth-client'

export default function Page() {
  const { data, isPending } = authClient.useSession()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setError('Use at least 6 characters.')
    if (password !== repeat) return setError("Passwords don't match.")
    setLoading(true)
    setError(null)
    const { error } = await authClient.updatePassword(password)
    setLoading(false)
    if (error) return setError(error.message)
    router.push('/?password=updated')
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
          <CardDescription>{data?.user?.email ? `For ${data.user.email}` : ' '}</CardDescription>
        </CardHeader>
        <CardContent>
          {!isPending && !data?.user ? (
            <p className="text-sm text-muted-foreground" role="alert">
              This reset link has expired or was already used.{' '}
              <Link href="/auth/forgot-password" className="underline">Send a new one</Link>.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat">Repeat new password</Label>
                <Input id="repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} className="h-11 text-base" />
              </div>
              {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
              <Button type="submit" className="w-full h-11" disabled={loading || isPending}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
