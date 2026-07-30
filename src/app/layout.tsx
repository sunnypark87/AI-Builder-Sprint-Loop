import type { Metadata } from 'next';
import { DonorHeader } from '@/components/layout/donor-header';
import './globals.css';

export const metadata: Metadata = {
  title: '모두기브 | 신뢰가 이어지는 기부',
  description: '기부 집행을 투명하게 관리하고 확인하는 모두기브',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <DonorHeader />
        {children}
      </body>
    </html>
  );
}
