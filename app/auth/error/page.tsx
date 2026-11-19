import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth-shell'

const REASONS: Record<string, string> = {
  otp_expired: 'This link has expired or was already used. Links work once and expire after an hour.',
  invalid_link: "This link isn't valid. Make sure you opened the whole link from the email.",
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
  const params = await searchParams
  const reason = params?.reason ?? params?.error
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">That link didn&apos;t work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{(reason && REASONS[reason]) ?? 'Something went wrong signing you in. Please try again.'}</p>
          <Link href="/auth/login" className="block">
            <Button className="w-full h-11">Sign in</Button>
          </Link>
          <Link href="/auth/forgot-password" className="block">
            <Button variant="outline" className="w-full h-11">Reset password</Button>
          </Link>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
