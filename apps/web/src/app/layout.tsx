import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono, Geist } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'FRIDAY',
  description: 'FRIDAY - a Gemini-powered conversational assistant',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn(spaceGrotesk.variable, jetbrainsMono.variable, "font-sans", geist.variable)}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <TooltipProvider delay={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
