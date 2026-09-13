'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [examCode, setExamCode] = useState('');
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (examCode.trim()) {
      router.push(`/gateway/${examCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center p-6">
      <div className="w-full max-w-4xl mx-auto pt-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
          🚀 โรงเรียนวัดบางปูน - EdTech Assessment Platform
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          ระบบจัดสอบออนไลน์และการวิเคราะห์ผลเชิงลึก
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base">
          แพลตฟอร์มสอบออนไลน์รองรับข้อสอบผสม ตรวจอัตโนมัติ พร้อมระบบป้องกันการทุจริตแบบเรียลไทม์ (Anti-Cheat) และอัลกอริทึมวิเคราะห์คุณภาพข้อสอบรายข้อ (Item Analysis CTT)
        </p>

        {/* Access Code Input */}
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4 text-left">
          <label className="block text-xs font-bold text-slate-300">
            ระบุรหัสเข้าสอบ (Exam Access Code)
          </label>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              placeholder="เช่น EXAM-SCI-01"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-sm font-mono uppercase"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-700/30 text-sm"
            >
              เข้าห้องสอบ
            </button>
          </form>
          <p className="text-xs text-slate-500">
            * หรือสแกน QR Code ประจำวิชาที่ครูผู้สอนส่งให้เพื่อเข้าสู่ Gateway ได้ทันที
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-left">
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-2xl">🛡️</div>
            <h3 className="font-bold text-white text-base">Anti-Cheat Proctoring</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              บังคับเต็มหน้าจอ (Fullscreen), ตรวจจับการสลับแท็บ/หน้าต่าง (Visibility API), ล็อกคัดลอก และนับการทำผิดกฎ
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-2xl">⚡</div>
            <h3 className="font-bold text-white text-base">Hybrid Grading Engine</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              ตรวจข้อสอบปรนัย เติมคำ จับคู่ ทันทีด้วย Server Engine และส่งข้อสอบอัตนัยเข้าคิวให้ครูผู้สอนตรวจ
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-2xl">📊</div>
            <h3 className="font-bold text-white text-base">Deep Item Analysis</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              วิเคราะห์ค่าความยากง่าย (p), อำนาจจำแนก (r) ตามกฎ 27% ของเคลลี่ และวิเคราะห์ประสิทธิภาพตัวลวงอัตโนมัติ
            </p>
          </div>
        </div>
      </div>

      <footer className="w-full text-center py-6 text-xs text-slate-600 border-t border-slate-900 mt-12">
        พัฒนาสำหรับระบบของครูซอส © 2569 โรงเรียนวัดบางปูน
      </footer>
    </div>
  );
}
