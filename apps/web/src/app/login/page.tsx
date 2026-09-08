'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/AuthProvider';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { status, login, register, error } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          <span className="text-[15px] font-medium tracking-[0.22em] text-muted-foreground">JARVIS</span>
        </div>

        <Card>
          <form onSubmit={onSubmit}>
            <CardHeader>
              <CardTitle className="text-[18px] font-normal">
                {mode === 'login' ? 'Sign in' : 'Create your account'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
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
