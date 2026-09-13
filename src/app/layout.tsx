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
  title: 'ระบบสอบออนไลน์ | โรงเรียนวัดบางปูน (Krusos Smart Assessment)',
  description: 'แพลตฟอร์มสอบออนไลน์มาตรฐาน พร้อมระบบตรวจจับการทุจริตและการวิเคราะห์ข้อสอบรายข้อ',
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
