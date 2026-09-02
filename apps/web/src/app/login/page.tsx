'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="flex h-screen w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center rounded-full border border-ac-l shadow-[0_0_14px_rgba(95,216,255,0.25)_inset]">
            <div className="h-5 w-5 rounded-full border border-ac-m" />
            <div className="absolute h-[7px] w-[7px] rounded-full bg-ac-tx shadow-[0_0_10px_2px_rgba(95,216,255,0.8)]" />
          </div>
          <span className="text-[15px] font-medium tracking-[0.22em] text-tx2">JARVIS</span>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-[18px] border border-line2 bg-panel2 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
        >
          <h1 className="mb-1 text-[18px] font-normal text-tx">
            {mode === 'login' ? 'Sign in' : 'Create your account'}
          </h1>

          {mode === 'register' && (
            <label className="flex flex-col gap-1.5 text-[12.5px] text-tx3">
              Name
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 rounded-[10px] border border-line2 bg-panel px-3 text-[14px] text-tx outline-none focus:border-ac-m"
                placeholder="Aditya Kapoor"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-[12.5px] text-tx3">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-[10px] border border-line2 bg-panel px-3 text-[14px] text-tx outline-none focus:border-ac-m"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[12.5px] text-tx3">
            Password
            <input
              required
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-[10px] border border-line2 bg-panel px-3 text-[14px] text-tx outline-none focus:border-ac-m"
              placeholder="••••••••"
            />
          </label>

          {error && <div className="text-[12.5px] text-danger">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 h-10 cursor-pointer rounded-[10px] border-0 bg-ac text-[13.5px] font-semibold text-ac-fg hover:bg-ac-hi disabled:cursor-default disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="cursor-pointer text-center text-[12.5px] text-tx3 hover:text-tx"
          >
            {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
