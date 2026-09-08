'use client';

import { Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/AuthProvider';
import { API_BASE_URL } from '@/lib/api';

type Mode = 'login' | 'register';

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.5-4.6 2.5-7.7 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 39.7 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.6 36.1 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login, register, error } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const googleError = searchParams.get('google') === 'error';

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
      router.replace('/');
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center rounded-full border border-ac-l shadow-[0_0_14px_rgba(95,216,255,0.25)_inset]">
            <div className="h-5 w-5 rounded-full border border-ac-m" />
            <div className="absolute h-[7px] w-[7px] rounded-full bg-ac-tx shadow-[0_0_10px_2px_rgba(95,216,255,0.8)]" />
          </div>
          <span className="text-[15px] font-medium tracking-[0.22em] text-muted-foreground">FRIDAY</span>
        </div>

        <Card>
          <form onSubmit={onSubmit}>
            <CardHeader>
              <CardTitle className="text-[18px] font-normal">
                {mode === 'login' ? 'Sign in' : 'Create your account'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {googleError && (
                <div className="text-[12.5px] text-destructive">
                  Could not sign in with Google. Please try again.
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2"
                onClick={() => {
                  window.location.href = `${API_BASE_URL}/google/authorize/login`;
                }}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 py-1 text-[12px] text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              {mode === 'register' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="displayName">Name</Label>
                  <Input
                    id="displayName"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-10"
                    placeholder="Aditya Kapoor"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  required
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                  placeholder="••••••••"
                />
              </div>

              {error && <div className="text-[12.5px] text-destructive">{error}</div>}

              <Button type="submit" disabled={submitting} className="mt-2 h-10">
                {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>

              <Button
                type="button"
                variant="link"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-muted-foreground"
              >
                {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
