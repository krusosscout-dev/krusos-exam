import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ระบบจัดสอบออนไลน์และการวิเคราะห์ผลเชิงลึก | EdTech Assessment',
  description: 'Centralized Multi-Subject Online Exam & Assessment Platform with Real-time Anti-Cheat and Item Analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
