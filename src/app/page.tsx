'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { INITIAL_EXAMS, getAllExams, ExamRecord } from '@/services/examData';

export default function HomePage() {
  const [examCode, setExamCode] = useState('');
  const [exams, setExams] = useState<ExamRecord[]>(INITIAL_EXAMS);
  const [selectedExam, setSelectedExam] = useState<ExamRecord | null>(null);
  const router = useRouter();

  useEffect(() => {
    setExams(getAllExams());
  }, []);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (examCode.trim()) {
      router.push(`/gateway/${examCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col justify-between bg-[#040711] text-slate-100 p-3 sm:p-5 select-none font-sans">
      {/* 1. Header Bar: Compact & Clean */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-1.5 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <img
            src="/logo.png"
            alt="โลโก้โรงเรียนวัดบางปูน"
            className="w-9 h-9 object-contain drop-shadow-md"
          />
          <div>
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide block leading-tight">
              โรงเรียนวัดบางปูน
            </span>
            <span className="text-[10px] sm:text-[11px] text-emerald-400 font-normal block">
              ระบบสอบออนไลน์ • สังคมศึกษา ประวัติศาสตร์ และป้องกันทุจริต
            </span>
          </div>
        </div>

        <Link
          href="/admin"
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm group"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>เข้าระบบครูผู้สอน (Admin)</span>
          <span className="text-slate-400 group-hover:translate-x-0.5 transition text-[10px]">→</span>
        </Link>
      </header>

      {/* 2. Main Hero Content (Strictly Single-Screen Height Fit) */}
      <main className="max-w-3xl w-full mx-auto flex flex-col items-center justify-center text-center my-auto space-y-3 sm:space-y-4">
        {/* Transparent Circular Logo */}
        <div className="relative">
          <img
            src="/logo.png"
            alt="โลโก้ระบบสอบออนไลน์"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)] hover:scale-105 transition-transform"
          />
        </div>

        {/* Title */}
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-normal">
            <span>🏛️</span> รายวิชาสังคมศึกษา ประวัติศาสตร์ และป้องกันทุจริต
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight pt-1">
            ระบบสอบออนไลน์
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-normal">
            วัดผลมาตรฐานและวิเคราะห์ข้อสอบเชิงลึก • โรงเรียนวัดบางปูน
          </p>
        </div>

        {/* Code Input Box: Ultra-sleek single card */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-300">ระบุรหัสเข้าสอบ (Exam Access Code)</span>
            <span className="text-emerald-400 font-mono text-[10px]">ตัวอย่าง: EXAM-SOC-01</span>
          </div>

          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="กรอกรหัสชุดข้อสอบ เช่น EXAM-SOC-01"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-white outline-none focus:border-emerald-500 text-xs sm:text-sm font-mono uppercase tracking-wider transition"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-md shadow-emerald-700/30 text-xs sm:text-sm whitespace-nowrap active:scale-95"
            >
              เข้าห้องสอบ 🚀
            </button>
          </form>
        </div>

        {/* Active Exams Section with Emojis & Click-to-View Details */}
        <div className="w-full max-w-2xl pt-1 space-y-2">
          <div className="flex items-center justify-between text-[11px] px-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <span className="text-emerald-400">🟢</span> วิชาที่กำลังเปิดสอบ (คลิกดูรายละเอียด)
            </span>
            <span className="text-slate-500 text-[10px]">แตะที่วิชาเพื่อดูคำชี้แจง</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {exams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => setSelectedExam(exam)}
                className="bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 p-2.5 sm:p-3 rounded-xl text-left transition shadow-md flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 flex items-center justify-center text-xl shrink-0 transition">
                  {exam.emoji || '📝'}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {exam.subjectCode}
                    </span>
                    <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {exam.durationMinutes}น.
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">
                    {exam.subjectName}
                  </h3>
                  <span className="text-[10px] text-slate-400 block -mt-0.5 group-hover:text-slate-300">
                    ดูรายละเอียด →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* 3. Footer Bar: Minimal & Fit */}
      <footer className="w-full max-w-5xl mx-auto py-1 text-center text-[10px] sm:text-[11px] text-slate-600 border-t border-slate-900/80">
        โรงเรียนวัดบางปูน • พัฒนาสื่อการเรียนรู้ 2569 โดยครูซอส
      </footer>

      {/* 4. Exam Detail Modal (ป๊อปอัปดูรายละเอียดวิชาสอบ) */}
      {selectedExam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in text-left">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl">
                  {selectedExam.emoji}
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {selectedExam.accessCode} • {selectedExam.subjectCode}
                  </span>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {selectedExam.subjectName}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedExam(null)}
                className="text-slate-400 hover:text-white text-lg px-2"
              >
                ✕
              </button>
            </div>

            {/* Exam Description */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">ชื่อชุดข้อสอบ:</span>
                <p className="font-semibold text-slate-200">{selectedExam.title}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">คำชี้แจง / รายละเอียด:</span>
                <p className="text-slate-300 bg-slate-800/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  {selectedExam.description}
                </p>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">ระยะเวลาสอบ</span>
                  <strong className="text-emerald-400 text-xs">{selectedExam.durationMinutes} นาที</strong>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">จำนวนข้อสอบ</span>
                  <strong className="text-white text-xs">{selectedExam.questions.length} ข้อ</strong>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">หลุดจอได้สูงสุด</span>
                  <strong className="text-amber-400 text-xs">{selectedExam.maxViolations} ครั้ง</strong>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
                ⚠️ <span className="text-slate-300 font-medium">ข้อกำหนด:</span> บังคับทำข้อสอบในโหมดเต็มหน้าจอ และระบบตรวจจับการสลับหน้าต่างแบบเรียลไทม์
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/gateway/${selectedExam.accessCode}`;
                  navigator.clipboard.writeText(url);
                  alert(`คัดลอกลิงก์ข้อสอบเรียบร้อยแล้ว!\n\n${url}`);
                }}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700"
              >
                📋 คัดลอกลิงก์
              </button>
              <button
                onClick={() => router.push(`/gateway/${selectedExam.accessCode}`)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-700/30 flex items-center justify-center gap-1.5"
              >
                เข้าสู่ห้องสอบทันที 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
