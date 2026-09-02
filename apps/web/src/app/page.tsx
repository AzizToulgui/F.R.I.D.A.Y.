import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';

export default function Page() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
