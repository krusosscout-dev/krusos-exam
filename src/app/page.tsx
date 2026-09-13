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
    <div className="h-screen w-screen overflow-hidden flex flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-6 select-none">
      {/* 1. Header Bar: School Logo & Admin Portal Access */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-emerald-900/40">
            ⚡
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide block">
              Krusos Smart Assessment
            </span>
            <span className="text-[11px] text-slate-400 block -mt-0.5">
              โรงเรียนวัดบางปูน • สื่อการเรียนรู้ระบบของครูซอส
            </span>
          </div>
        </div>

        {/* เข้าสู่ระบบแอดมิน/ครูผู้สอน */}
        <Link
          href="/admin"
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-emerald-500/60 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition shadow-md group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 group-hover:animate-ping"></span>
          <span>ระบบจัดการข้อสอบ (Admin / ครูผู้สอน)</span>
          <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
        </Link>
      </header>

      {/* 2. Center Hero: Single-screen Compact Layout */}
      <main className="max-w-3xl w-full mx-auto flex flex-col items-center justify-center text-center my-auto space-y-5">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span>🎯</span> Centralized Multi-Subject Assessment Platform
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            ระบบจัดสอบออนไลน์และวิเคราะห์ผลเชิงลึก
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
            วัดผลมาตรฐานด้วยระบบตรวจอัตโนมัติผสมข้อเขียน ตรวจจับการทุจริตแบบเรียลไทม์ และวิเคราะห์ค่าความยากง่าย (p) อำนาจจำแนก (r) รายข้อ
          </p>
        </div>

        {/* Access Box */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-2xl backdrop-blur-sm space-y-3">
          <div className="text-left flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              ระบุรหัสเข้าสอบ (Exam Access Code)
            </label>
            <span className="text-[10px] text-emerald-400 font-mono">
              ตัวอย่าง: EXAM-SCI-01
            </span>
          </div>

          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="กรอกรหัส เช่น EXAM-SCI-01"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-sm font-mono uppercase tracking-wider transition"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-700/30 text-sm whitespace-nowrap active:scale-95"
            >
              เข้าห้องสอบ 🚀
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center">
            * นักเรียนสามารถสแกน QR Code ประจำวิชาเพื่อเข้าสู่ห้องสอบได้โดยตรง
          </p>
        </div>

        {/* 3 Compact Feature Pills (No vertical overflow) */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-2xl pt-2">
          <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-left space-y-1">
            <div className="text-emerald-400 text-base font-bold">🛡️ Anti-Cheat</div>
            <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
              บังคับเต็มจอ ตรวจจับสลับแท็บ ยุบหน้าจอ และล็อกคัดลอก
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-left space-y-1">
            <div className="text-blue-400 text-base font-bold">⚡ Hybrid Grading</div>
            <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
              ตรวจปรนัย-เติมคำทันที และระบบให้คะแนนข้อเขียนโดยครู
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-left space-y-1">
            <div className="text-purple-400 text-base font-bold">📊 Item Analysis</div>
            <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
              สูตร 27% เคลลี่ วิเคราะห์ค่าความยาก p และอำนาจจำแนก r
            </p>
          </div>
        </div>
      </main>

      {/* 3. Footer Bar */}
      <footer className="w-full max-w-6xl mx-auto py-2 text-center text-[11px] text-slate-600 border-t border-slate-900">
        Krusos Smart Assessment © 2569 • พัฒนาเพื่อการศึกษา โรงเรียนวัดบางปูน
      </footer>
    </div>
  );
}
