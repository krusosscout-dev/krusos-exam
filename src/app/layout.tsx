import type { Metadata } from 'next';
import { Kanit } from 'next/font/google';
import './globals.css';

// ใช้ฟอนต์ Kanit (คณิต) - โมเดิร์น ไม่มีหัว ชัดเจน สไตล์ EdTech ยอดนิยม
const kanit = Kanit({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-kanit',
});

export const metadata: Metadata = {
  title: 'Krusos Smart Assessment | ระบบจัดสอบออนไลน์ โรงเรียนวัดบางปูน',
  description: 'แพลตฟอร์มสอบออนไลน์มาตรฐาน พร้อมระบบตรวจจับการทุจริตและการวิเคราะห์ข้อสอบรายข้อ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={kanit.variable}>
      <body className={`${kanit.className} antialiased bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
