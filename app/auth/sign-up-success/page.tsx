'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth-shell'
import { authClient } from '@/lib/auth-client'

function Content() {
  const email = useSearchParams().get('email') ?? ''
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle')

  const resend = async () => {
    setState('sending')
    const { error } = await authClient.resendConfirmation(email)
    setState(error ? error.message : 'sent')
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2" aria-hidden="true">
          <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          We sent a confirmation link{email ? <> to <strong className="text-foreground">{email}</strong></> : null}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Tap the link in the email to confirm your account. It can take a minute — check spam too. Using the Android
          app? After confirming, come back to the app and sign in.
        </p>
        {email && (
          <Button variant="secondary" className="w-full h-11" onClick={() => void resend()} disabled={state === 'sending'}>
            {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {state === 'sent' ? 'Sent again ✓' : 'Resend email'}
          </Button>
        )}
        {state !== 'idle' && state !== 'sending' && state !== 'sent' && (
          <p className="text-sm text-red-500" role="alert">{state}</p>
        )}
        <Link href="/auth/login" className="block">
          <Button variant="outline" className="w-full h-11">Back to sign in</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

export default function Page() {
  return (
    <AuthShell>
      <Suspense>
        <Content />
      </Suspense>
    </AuthShell>
  )
}
