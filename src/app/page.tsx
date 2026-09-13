'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { INITIAL_EXAMS, getAllExams, ExamRecord } from '@/services/examData';

export default function HomePage() {
  const [examCode, setExamCode] = useState('');
  const [exams, setExams] = useState<ExamRecord[]>(INITIAL_EXAMS);
  const [selectedExam, setSelectedExam] = useState<ExamRecord | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const router = useRouter();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 220;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const loaded = getAllExams();
    if (typeof window !== 'undefined') {
      const active = loaded.filter((exam) => {
        const isClosed = localStorage.getItem(`exam_closed_${exam.accessCode.toUpperCase()}`) === 'true';
        if (isClosed) return false;
        return exam.isOpen !== false;
      });
      setExams(active);
    } else {
      setExams(loaded);
    }
  }, []);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (examCode.trim()) {
      router.push(`/gateway/${examCode.trim().toUpperCase()}`);
    }
  };

  const handleCopyLink = (accessCode: string) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/gateway/${accessCode}`;
      navigator.clipboard.writeText(url);
      setCopiedSuccess(true);
      setToastMessage('คัดลอกลิงก์ชุดข้อสอบเรียบร้อยแล้ว ส่งต่อให้นักเรียนได้ทันที 📋');
      setTimeout(() => setCopiedSuccess(false), 2500);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <div className="relative min-h-screen lg:h-screen w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden flex flex-col justify-between bg-[#030712] text-slate-100 p-3 sm:p-5 select-none font-sans">
      {/* Background Ambient Lighting & Glow Effects */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-80 h-80 bg-emerald-700/10 rounded-full blur-[110px] pointer-events-none" />

      {/* 1. Header Bar: School Badge (Left) + Live Status (Center) + Admin Gate (Right) */}
      <header className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between py-1 px-1 sm:px-2">
        {/* Left: School Identity */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900/90 border border-slate-800 p-1 flex items-center justify-center shadow-inner">
            <img src="/logo.png" alt="โลโก้โรงเรียนวัดบางปูน" className="w-full h-full object-contain" />
          </div>
          <div className="text-left leading-tight">
            <span className="text-xs font-bold text-slate-200 block">โรงเรียนวัดบางปูน</span>
            <span className="text-[10px] text-slate-500 hidden sm:block">สพป.สิงห์บุรี</span>
          </div>
        </div>

        {/* Center: System Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 shadow-sm backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">ระบบออนไลน์พร้อมใช้งาน</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-mono text-[10px]">ปีการศึกษา 2569</span>
        </div>

        {/* Right: Admin Gateway Button with Label */}
        <Link
          href="/admin"
          title="เข้าระบบครูผู้สอน (Admin Portal)"
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-slate-300 hover:text-emerald-400 transition-all shadow-sm backdrop-blur-md flex items-center gap-2 group text-xs font-medium"
        >
          <svg className="w-4 h-4 text-emerald-400 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="hidden sm:inline">สำหรับครูผู้สอน</span>
        </Link>
      </header>

      {/* 2. Main Hero Content (Auto-Responsive Height Fit) */}
      <main className="relative z-10 max-w-3xl w-full mx-auto flex flex-col items-center justify-center text-center my-3 lg:my-auto space-y-3 sm:space-y-3.5">
        {/* Large Transparent Circular Logo with Ambient Glow */}
        <div className="relative group">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl group-hover:bg-emerald-500/30 transition-all duration-500" />
          <img
            src="/logo.png"
            alt="โลโก้ KruSos Smart Assessment"
            className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)] hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Modern Title & Teacher Branding */}
        <div className="space-y-2 max-w-2xl px-2">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
              KRUSOS SMART ASSESSMENT PLATFORM
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight leading-tight">
            ระบบวัดและประเมินผลการเรียนรู้อัจฉริยะ
          </h1>

          {/* Department & Teacher Metadata (คนละบรรทัด สวยงาม สมบูรณ์แบบ) */}
          <div className="flex flex-col items-center justify-center gap-1.5 pt-0.5">
            <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] sm:text-xs text-slate-300 font-medium shadow-sm backdrop-blur-md">
              กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนาและวัฒนธรรม
            </div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-[11px] sm:text-xs text-emerald-300 font-medium shadow-sm backdrop-blur-md">
              <span>👨‍🏫</span> ครูผู้สอน นายนรากรณ์ จูงาม (ครูซอสสอนสังคม)
            </div>
          </div>
        </div>

        {/* Code Input Box: Glassmorphic high-tech card */}
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 p-3 sm:p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] space-y-2">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <span>🔑</span> ระบุรหัสเข้าสอบ (Exam Access Code)
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">ตัวอย่าง: EXAM-SOC-01</span>
          </div>

          <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-2 relative">
            <div className="relative flex-1">
              <input
                type="text"
                required
                placeholder="กรอกรหัสชุดข้อสอบ เช่น EXAM-SOC-01"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 pr-8 bg-slate-950/70 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-white outline-none text-xs sm:text-sm font-mono uppercase tracking-wider transition focus:ring-1 focus:ring-emerald-500/40 shadow-inner"
              />
              {examCode && (
                <button
                  type="button"
                  onClick={() => setExamCode('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/30 text-xs sm:text-sm whitespace-nowrap active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>เข้าห้องสอบ</span>
              <span>🚀</span>
            </button>
          </form>
        </div>

        {/* Active Exams Section with Auto-Centering & Slider for >3 items */}
        <div className="w-full max-w-2xl pt-0.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] px-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <span className={`text-xs ${exams.length > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                {exams.length > 0 ? '🟢' : '⚪'}
              </span>
              <span>วิชาที่กำลังเปิดสอบ {exams.length > 0 ? `(${exams.length} วิชา)` : ''}</span>
            </span>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px]">
                {exams.length > 3 ? 'เลื่อนซ้าย-ขวาเพื่อดูวิชาเพิ่ม' : 'แตะที่วิชาเพื่อดูคำชี้แจงและเริ่มสอบ'}
              </span>
              {exams.length > 3 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleScroll('left')}
                    className="w-5 h-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold transition border border-slate-700 active:scale-90 shadow-sm"
                    title="เลื่อนไปทางซ้าย"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScroll('right')}
                    className="w-5 h-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold transition border border-slate-700 active:scale-90 shadow-sm"
                    title="เลื่อนไปทางขวา"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>

          {exams.length > 0 ? (
            <div
              ref={scrollRef}
              className={`flex gap-2 sm:gap-2.5 overflow-x-auto pt-1.5 pb-1.5 px-1 scroll-smooth ${
                exams.length <= 3 ? 'justify-center flex-wrap' : 'justify-start'
              }`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {exams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => {
                    setSelectedExam(exam);
                    setCopiedSuccess(false);
                  }}
                  className="w-full sm:w-[205px] flex-shrink-0 bg-slate-900/80 hover:bg-slate-800/95 backdrop-blur-md border border-slate-800 hover:border-emerald-400 p-2.5 sm:p-3 rounded-2xl text-left transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-emerald-950/40 flex items-center space-x-3 group relative"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800/90 group-hover:bg-emerald-500/20 border border-slate-700/50 group-hover:border-emerald-500/30 flex items-center justify-center text-xl shrink-0 transition">
                    {exam.emoji || '📝'}
                  </div>
                  <div className="overflow-hidden flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        {exam.subjectCode}
                      </span>
                      <span className="text-[9px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
                        {exam.durationMinutes}น.
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">
                      {exam.subjectName}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 -mt-0.5 group-hover:text-emerald-400 transition">
                      <span>{exam.questions.length} ข้อ</span>
                      <span>เข้าสอบ →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-900/70 border border-slate-800/90 rounded-2xl text-center space-y-1.5 backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 flex items-center justify-center text-lg mx-auto shadow-inner">
                🔒
              </div>
              <div className="text-xs text-slate-200 font-bold">
                ขณะนี้ยังไม่มีวิชาที่เปิดรับคำตอบทั่วไป
              </div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                หากคุณครูได้แจกรหัสข้อสอบประจำห้องเรียน กรุณากรอกรหัสในช่อง <strong className="text-emerald-400">"ระบุรหัสเข้าสอบ"</strong> ด้านบนเพื่อเริ่มทำข้อสอบได้ทันทีครับ
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 3. Footer Bar: Minimal & Fit */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto py-1 text-center text-[10px] sm:text-[11px] text-slate-500 border-t border-slate-900/80">
        © 2026 เพจตามติดชีวิต KruSos
      </footer>

      {/* 4. Exam Detail Modal (ป๊อปอัปดูรายละเอียดวิชาสอบแบบโมเดิร์น) */}
      {selectedExam && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedExam(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="max-w-md w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4 text-left backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl shadow-inner">
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
                className="text-slate-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-slate-800 transition"
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
                <p className="text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed max-h-28 overflow-y-auto">
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

            {/* Actions: Replaced browser alert with toast notification */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleCopyLink(selectedExam.accessCode)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition border flex items-center justify-center gap-1.5 active:scale-95 ${
                  copiedSuccess
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                }`}
              >
                <span>{copiedSuccess ? '✓' : '📋'}</span>
                <span>{copiedSuccess ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}</span>
              </button>
              <button
                onClick={() => router.push(`/gateway/${selectedExam.accessCode}`)}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 active:scale-95"
              >
                เข้าสู่ห้องสอบทันที 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modern Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-md ml-auto">
          <div className="px-4 py-3 bg-slate-900/95 border border-emerald-500/50 text-white rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3">
            <span className="text-xl">✨</span>
            <div className="text-xs">
              <div className="font-bold text-emerald-400">แจ้งเตือนระบบ</div>
              <div className="text-slate-300 text-[11px]">{toastMessage}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
