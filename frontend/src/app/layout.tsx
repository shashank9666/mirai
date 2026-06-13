import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ThemeHydration from '@/components/ThemeHydration';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mirai IDE',
  description: 'Premium Glassmorphic IDE',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground overflow-hidden h-screen w-screen flex flex-col`} suppressHydrationWarning>
        <ThemeHydration />
        {children}
      </body>
    </html>
  );
}
