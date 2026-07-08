import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OddsPool',
  description: 'Free prediction pools. World Cup 2026.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-mist-gray text-midnight-ink font-figtree">{children}</body>
    </html>
  );
}
