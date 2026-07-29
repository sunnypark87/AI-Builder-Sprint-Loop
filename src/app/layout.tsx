import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Builder Sprint 2026',
  description: 'AI Builder Sprint 해커톤 프로젝트',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
