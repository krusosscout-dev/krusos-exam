import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

const promptFont = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  display: 'swap',
  variable: '--font-prompt',
});

export const metadata: Metadata = {
  title: 'Krusos Smart Assessment | ระบบจัดสอบออนไลน์และวิเคราะห์ผลเชิงลึก โรงเรียนวัดบางปูน',
  description: 'แพลตฟอร์มสอบออนไลน์มาตรฐาน พร้อมระบบป้องกันการทุจริตแบบเรียลไทม์ และการวิเคราะห์คุณภาพข้อสอบรายข้อ (Item Analysis CTT)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={promptFont.variable}>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
