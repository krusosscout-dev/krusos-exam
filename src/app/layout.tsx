import type { Metadata, Viewport } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

// ใช้ฟอนต์ Prompt (พร้อมท์) - โมเดิร์น ทันสมัย อ่านง่าย ชัดเจน สไตล์มินิมอลยอดนิยม
const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-prompt',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'KruSos Exam | ระบบสอบออนไลน์',
  description: 'KruSos Exam - ระบบสอบออนไลน์ โรงเรียนวัดบางปูน สพป.สิงห์บุรี (ครูซอส)',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className={`${prompt.className} antialiased bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
