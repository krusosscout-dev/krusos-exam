'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { INITIAL_EXAMS } from '@/services/examData';

export default function HomePage() {
  const [examCode, setExamCode] = useState('');
  const router = useRouter();

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (examCode.trim()) {
      router.push(`/gateway/${examCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* 1. Header Bar with Logo */}
      <header className="w-full bg-slate-900/70 backdrop-blur-md border-b border-slate-800/80 px-6 py-3 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            {/* Transparent Circular Logo */}
            <div className="relative group">
              <img
                src="/logo.png"
                alt="โลโก้ระบบสอบออนไลน์ โรงเรียนวัดบางปูน"
                className="w-12 h-12 object-contain drop-shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-transform group-hover:scale-105"
              />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-wide block leading-tight">
                โรงเรียนวัดบางปูน
              </span>
              <span className="text-xs text-emerald-400 font-normal block">
                ระบบสอบออนไลน์ • สังคมศึกษา ประวัติศาสตร์ และป้องกันทุจริต
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/admin"
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-slate-700 hover:border-emerald-500/60 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm group"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 group-hover:scale-125 transition"></span>
              <span>เข้าระบบครูผู้สอน (Admin)</span>
              <span className="text-slate-400 group-hover:translate-x-1 transition">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero & Examination Center */}
      <main className="max-w-6xl w-full mx-auto px-4 py-8 md:py-10 flex-1 flex flex-col justify-center space-y-8">
        {/* Title Block with Center Logo */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="flex justify-center mb-1">
            <img
              src="/logo.png"
              alt="โลโก้ระบบสอบออนไลน์"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] animate-fade-in"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-normal">
            <span>🏛️</span> รายวิชาสังคมศึกษา ประวัติศาสตร์ และป้องกันทุจริต
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            ระบบสอบออนไลน์
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-normal leading-relaxed">
            วัดผลมาตรฐานและวิเคราะห์ข้อสอบเชิงลึก โรงเรียนวัดบางปูน • ระบบของครูซอส
          </p>
        </div>

        {/* Quick Access Card: Code Input */}
        <div className="max-w-xl w-full mx-auto bg-slate-900/90 border border-slate-800/90 p-5 md:p-6 rounded-3xl shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300">
              ระบุรหัสเข้าสอบ (Exam Access Code)
            </label>
            <span className="text-[11px] text-emerald-400 font-mono">
              ตัวอย่าง: EXAM-SOC-01
            </span>
          </div>

          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="กรอกรหัสชุดข้อสอบ เช่น EXAM-SOC-01"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-mono uppercase tracking-wider transition placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition shadow-lg shadow-emerald-700/30 text-sm whitespace-nowrap active:scale-95"
            >
              เข้าห้องสอบ 🚀
            </button>
          </form>
          <p className="text-[11px] text-slate-500 text-center mt-2.5 font-normal">
            * หรือคลิกเลือกวิชาที่เปิดสอบด้านล่างเพื่อเข้าสู่หน้าระบุตัวตนได้ทันที
          </p>
        </div>

        {/* Active Exams Section (ข้อสอบที่เปิดให้เข้าสอบตอนนี้) */}
        <div className="space-y-4 max-w-5xl mx-auto w-full pt-1">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 text-sm">🟢</span>
              <h2 className="text-sm md:text-base font-bold text-white tracking-wide">
                วิชาที่กำลังเปิดสอบในขณะนี้ (Active Exams)
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-normal">
              คลิกเพื่อเข้าสอบทันที
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {INITIAL_EXAMS.map((exam) => (
              <div
                key={exam.id}
                className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 p-5 rounded-2xl transition shadow-lg flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                      {exam.accessCode}
                    </span>
                    <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                      ⏱️ {exam.durationMinutes} นาที
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm md:text-base group-hover:text-emerald-300 transition line-clamp-2">
                    {exam.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    วิชา: <strong className="text-slate-300">{exam.subjectCode} {exam.subjectName}</strong>
                  </p>
                </div>

                <Link
                  href={`/gateway/${exam.accessCode}`}
                  className="w-full py-2.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700 hover:border-emerald-500 shadow-sm"
                >
                  <span>เข้าสอบวิชานี้</span>
                  <span className="group-hover:translate-x-1 transition">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto w-full pt-2 text-xs">
          <div className="p-3.5 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex items-center space-x-3">
            <div className="text-xl">🛡️</div>
            <div>
              <strong className="text-slate-200 block text-xs">Anti-Cheat Proctoring</strong>
              <span className="text-slate-400 text-[11px]">บังคับเต็มจอ ตรวจจับสลับแท็บ และล็อกคัดลอก</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex items-center space-x-3">
            <div className="text-xl">⚡</div>
            <div>
              <strong className="text-slate-200 block text-xs">Hybrid Grading Engine</strong>
              <span className="text-slate-400 text-[11px]">ตรวจข้อสอบอัตโนมัติ พร้อมระบบตรวจข้อเขียน</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex items-center space-x-3">
            <div className="text-xl">📊</div>
            <div>
              <strong className="text-slate-200 block text-xs">Item Analysis (CTT)</strong>
              <span className="text-slate-400 text-[11px]">วิเคราะห์ค่าความยากง่าย (p) และอำนาจจำแนก (r)</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-900/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>โรงเรียนวัดบางปูน • พัฒนาสื่อการเรียนรู้ 2569 โดยครูซอส</span>
          <span className="text-slate-600">กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม</span>
        </div>
      </footer>
    </div>
  );
}
