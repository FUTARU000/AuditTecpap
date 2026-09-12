'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, Input, Label } from '@tecpap/ui';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { RequestError } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      toast.success(`Welcome back, ${user.firstName}`);
      router.replace(searchParams.get('next') ?? '/dashboard');
    } catch (error) {
      const message = error instanceof RequestError ? error.message : 'Unable to sign in.';
      toast.error(message);
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border border-white/15 bg-[hsl(25_30%_11%/0.55)] shadow-md backdrop-blur-sm">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-white/90">
              {t('common.email', 'Email')}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@tecpap.ma"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              className="border-white/30 bg-white/95 text-neutral-900 placeholder:text-neutral-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-white/90">
              {t('common.password', 'Password')}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              className="border-white/30 bg-white/95 text-neutral-900 placeholder:text-neutral-500"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('login.button', 'Sign in')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-white/60">
          admin@tecpap.ma / Admin123! · audit.manager@tecpap.ma / Audit123! ·
          pilot.production@tecpap.ma / Pilot123!
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/* Background image on its own layer, filtered for richer color — kept
          separate from the content so the filter never touches the text/panel above it. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/tecpap-building.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'saturate(1.6) contrast(1.15) brightness(1.08)',
        }}
        aria-hidden="true"
      />

      {/* Subtle dark overlay for readability — building remains recognizable */}
      <div className="bg-foreground/25 absolute inset-0" aria-hidden="true" />

      {/* Content layer above the background */}
      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-8 flex -translate-y-3 flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-lg shadow-lg">
            <ClipboardCheck className="size-6" />
          </span>
          <div>
            <p className="text-lg font-semibold text-white drop-shadow-md">
              {t('login.title', 'TECPAP Audit Platform')}
            </p>
            <p className="text-sm text-white/80 drop-shadow-sm">
              {t('login.subtitle', 'Sign in to your account')}
            </p>
          </div>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
