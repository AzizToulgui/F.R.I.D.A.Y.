'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-[1.5px] border-ac-m border-t-ac" />
      </div>
    );
  }

  return <>{children}</>;
}
