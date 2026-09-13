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
    <div className="h-screen w-screen overflow-hidden flex flex-col justify-between bg-[#030712] text-slate-100 p-4 md:p-6 select-none">
      {/* 1. Top Navbar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-lg text-slate-950 shadow-lg shadow-emerald-500/20">
            ⚡
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide block">
              Krusos Smart Assessment
            </span>
            <span className="text-[11px] text-slate-400 block -mt-0.5 font-normal">
              โรงเรียนวัดบางปูน • สื่อการเรียนรู้ระบบของครูซอส
            </span>
          </div>
        </div>

        {/* เข้าสู่ระบบแอดมิน */}
        <Link
          href="/admin"
          className="flex items-center space-x-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl text-xs font-medium text-slate-200 hover:text-white transition shadow-sm group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>ระบบจัดการข้อสอบ (Admin)</span>
          <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
        </Link>
      </header>

      {/* 2. Hero Center */}
      <main className="max-w-4xl w-full mx-auto flex flex-col items-center justify-center text-center my-auto space-y-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-normal">
          <span>🎯</span> Centralized Multi-Subject Assessment Platform
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-normal">
            ระบบสอบออนไลน์
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-normal max-w-lg mx-auto pt-1 leading-relaxed">
            ระบบวัดผลและวิเคราะห์ข้อสอบเชิงลึก • โรงเรียนวัดบางปูน
          </p>
        </div>

        {/* Access Box */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
          <div className="text-left flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
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
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-sm font-mono uppercase tracking-wider transition"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition shadow-lg shadow-emerald-700/30 text-sm whitespace-nowrap active:scale-95"
            >
              เข้าห้องสอบ 🚀
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center font-normal">
            * นักเรียนสามารถสแกน QR Code ประจำวิชาเพื่อเข้าสอบได้โดยตรง
          </p>
        </div>

        {/* 3 Compact Feature Badges */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xl pt-1">
          <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-left">
            <div className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
              <span>🛡️</span> Anti-Cheat
            </div>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
              บังคับเต็มจอ ตรวจจับสลับแท็บ และล็อกคัดลอก
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-left">
            <div className="text-blue-400 text-sm font-semibold flex items-center gap-1.5">
              <span>⚡</span> Hybrid Grading
            </div>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
              ตรวจปรนัยทันที และมีระบบให้คะแนนข้อเขียน
            </p>
          </div>

          <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-left">
            <div className="text-purple-400 text-sm font-semibold flex items-center gap-1.5">
              <span>📊</span> Item Analysis
            </div>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
              สูตร 27% เคลลี่ วิเคราะห์ค่าความยาก p และอำนาจจำแนก r
            </p>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="w-full max-w-6xl mx-auto py-2 text-center text-[11px] text-slate-600 border-t border-slate-900 font-normal">
        Krusos Smart Assessment © 2569 • พัฒนาเพื่อการศึกษา โรงเรียนวัดบางปูน
      </footer>
    </div>
  );
}
