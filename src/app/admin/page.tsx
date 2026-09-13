'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { generateExamQRCodeDataUrl } from '@/utils/qrGenerator';

interface ExamItem {
  id: string;
  accessCode: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  durationMinutes: number;
  classrooms: string[];
  maxViolations: number;
  totalStudents: number;
  status: 'PUBLISHED' | 'DRAFT';
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'essays' | 'analytics'>('exams');
  
  // Sample exams state
  const [exams, setExams] = useState<ExamItem[]>([
    {
      id: 'ex-001',
      accessCode: 'EXAM-SCI-01',
      subjectCode: 'ว21101',
      subjectName: 'วิทยาศาสตร์และเทคโนโลยี 1',
      title: 'แบบทดสอบกลางภาคเรียนที่ 1/2569 (หน่วยเซลล์ของสิ่งมีชีวิต)',
      durationMinutes: 60,
      classrooms: ['ม.1/1', 'ม.1/2'],
      maxViolations: 3,
      totalStudents: 42,
      status: 'PUBLISHED',
    },
    {
      id: 'ex-002',
      accessCode: 'EXAM-MATH-01',
      subjectCode: 'ค21101',
      subjectName: 'คณิตศาสตร์พื้นฐาน 1',
      title: 'แบบทดสอบเก็บคะแนน เรื่อง จำนวนเต็มและเลขยกกำลัง',
      durationMinutes: 50,
      classrooms: ['ม.1/1'],
      maxViolations: 2,
      totalStudents: 0,
      status: 'DRAFT',
    },
  ]);

  // QR Code Modal state
  const [qrModal, setQrModal] = useState<{ isOpen: boolean; accessCode: string; qrDataUrl: string }>({
    isOpen: false,
    accessCode: '',
    qrDataUrl: '',
  });

  // Create Exam Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExam, setNewExam] = useState({
    subjectCode: 'ว21101',
    subjectName: 'วิทยาศาสตร์และเทคโนโลยี 1',
    title: '',
    accessCode: '',
    durationMinutes: 60,
    maxViolations: 3,
  });

  // Essay grading sample state
  const [essaySubmissions, setEssaySubmissions] = useState([
    {
      id: 'ans-1',
      studentName: 'ด.ช. กิตติศักดิ์ มั่งมี',
      studentId: '54321',
      classroom: 'ม.1/1',
      question: 'จงอธิบายความแตกต่างระหว่างเซลล์พืชและเซลล์สัตว์อย่างน้อย 3 ประการ',
      studentResponse: '1. เซลล์พืชมีผนังเซลล์ แต่เซลล์สัตว์ไม่มี\n2. เซลล์พืชมีคลอโรพลาสต์สำหรับสังเคราะห์แสง แต่เซลล์สัตว์ไม่มี\n3. แวคิวโอลของเซลล์พืชมีขนาดใหญ่ ส่วนเซลล์สัตว์มีขนาดเล็กหรือไม่มีเลยครับ',
      maxPoints: 5.0,
      awardedScore: '',
      feedback: '',
      isGraded: false,
    },
    {
      id: 'ans-2',
      studentName: 'ด.ญ. ชนิกานต์ สว่างใจ',
      studentId: '54322',
      classroom: 'ม.1/1',
      question: 'จงอธิบายความแตกต่างระหว่างเซลล์พืชและเซลล์สัตว์อย่างน้อย 3 ประการ',
      studentResponse: 'เซลล์พืชมีรูปร่างเป็นเหลี่ยม มีคลอโรฟิลล์ ส่วนเซลล์สัตว์เป็นทรงกลม ไม่มีผนังเซลล์',
      maxPoints: 5.0,
      awardedScore: '4.0',
      feedback: 'อธิบายได้ดี แต่ขาดการระบุเรื่องแวคิวโอลเพิ่มเติม',
      isGraded: true,
    },
  ]);

  const openQrModal = async (accessCode: string) => {
    const directUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/gateway/${accessCode}`
      : `https://krusos-exam.vercel.app/gateway/${accessCode}`;
    const qrDataUrl = await generateExamQRCodeDataUrl(directUrl);
    setQrModal({ isOpen: true, accessCode, qrDataUrl });
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.title || !newExam.accessCode) return;

    setExams((prev) => [
      ...prev,
      {
        id: `ex-${Date.now()}`,
        accessCode: newExam.accessCode.toUpperCase(),
        subjectCode: newExam.subjectCode,
        subjectName: newExam.subjectName,
        title: newExam.title,
        durationMinutes: Number(newExam.durationMinutes),
        classrooms: ['ม.1/1', 'ม.1/2'],
        maxViolations: Number(newExam.maxViolations),
        totalStudents: 0,
        status: 'PUBLISHED',
      },
    ]);
    setShowCreateModal(false);
    setNewExam({
      subjectCode: 'ว21101',
      subjectName: 'วิทยาศาสตร์และเทคโนโลยี 1',
      title: '',
      accessCode: '',
      durationMinutes: 60,
      maxViolations: 3,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 1. Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <img
            src="/logo.png"
            alt="โลโก้ระบบสอบออนไลน์"
            className="w-10 h-10 object-contain drop-shadow-md"
          />
          <div>
            <h1 className="text-sm font-bold text-white">ระบบจัดการข้อสอบ (Admin Portal)</h1>
            <p className="text-xs text-slate-400">กลุ่มสาระสังคมศึกษาฯ • โรงเรียนวัดบางปูน</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-emerald-400 block">ครูผู้สอน / ผู้ดูแลระบบ</span>
            <span className="text-[11px] text-slate-400">กลุ่มสาระการเรียนรู้วิทยาศาสตร์ฯ</span>
          </div>
          <Link
            href="/"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-lg text-slate-300 transition"
          >
            ← หน้าแรกนักเรียน
          </Link>
        </div>
      </header>

      {/* 2. Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6">
        <div className="max-w-6xl mx-auto flex space-x-2">
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'exams'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 จัดการชุดข้อสอบ & QR Code
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'questions'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✏️ คลังข้อสอบ (5 ประเภท)
          </button>
          <button
            onClick={() => setActiveTab('essays')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'essays'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✍️ ตรวจข้อสอบอัตนัย
            <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full">
              1 รอตรวจ
            </span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 สถิติ & คุณภาพข้อสอบ (Item Analysis CTT)
          </button>
        </div>
      </div>

      {/* 3. Main Body Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* TAB 1: EXAMS & QR CODE */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">ชุดข้อสอบทั้งหมด</h2>
                <p className="text-xs text-slate-400">สร้างชุดข้อสอบ กำหนดเวลา นโยบายกันทุจริต และแจกลิงก์/QR Code</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-700/30 flex items-center gap-1.5"
              >
                + สร้างชุดข้อสอบใหม่
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                        {exam.accessCode}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {exam.status === 'PUBLISHED' ? 'เปิดสอบแล้ว' : 'ฉบับร่าง'}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base leading-snug">{exam.title}</h3>
                    <p className="text-xs text-slate-400">
                      วิชา: <strong className="text-slate-200">{exam.subjectCode} {exam.subjectName}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 text-center text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">ระยะเวลา</span>
                      <span className="font-bold text-slate-200">{exam.durationMinutes} นาที</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">หลุดจอได้สูงสุด</span>
                      <span className="font-bold text-red-400">{exam.maxViolations} ครั้ง</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">ส่งข้อสอบแล้ว</span>
                      <span className="font-bold text-emerald-400">{exam.totalStudents} คน</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        const url = typeof window !== 'undefined'
                          ? `${window.location.origin}/gateway/${exam.accessCode}`
                          : `https://krusos-exam.vercel.app/gateway/${exam.accessCode}`;
                        navigator.clipboard.writeText(url);
                        alert(`คัดลอกลิงก์ข้อสอบวิชา ${exam.subjectName} (${exam.accessCode}) เรียบร้อยแล้ว!\n\nลิงก์: ${url}\n\nคุณครูสามารถนำไปวางในกลุ่ม LINE, Facebook หรือ Google Classroom ให้นักเรียนกรอกชื่อแล้วเริ่มสอบได้ทันที`);
                      }}
                      className="w-full sm:flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30"
                    >
                      📋 คัดลอกลิงก์ส่งให้นักเรียน
                    </button>
                    <button
                      onClick={() => openQrModal(exam.accessCode)}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition text-slate-200 flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      📱 QR Code
                    </button>
                    <Link
                      href={`/gateway/${exam.accessCode}`}
                      target="_blank"
                      className="w-full sm:w-auto px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 border border-slate-700/60"
                      title="เปิดดูหน้า Gateway ของนักเรียน"
                    >
                      👁️ ดูหน้าสอบ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-white text-base">รายการข้อสอบในชุด EXAM-SCI-01</h3>
                <p className="text-xs text-slate-400">รองรับข้อสอบผสม 5 รูปแบบ ตรวจอัตโนมัติและส่งตรวจโดยครู</p>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full font-bold">
                รวม 5 ข้อ (12 คะแนนเต็ม)
              </span>
            </div>

            <div className="space-y-3">
              {[
                { num: 1, type: 'ปรนัย (Multiple Choice)', points: 1, prompt: 'โครงสร้างใดของเซลล์พืชทำหน้าที่สังเคราะห์แสงเพื่อสร้างอาหาร?', key: 'คลอโรพลาสต์' },
                { num: 2, type: 'ถูก/ผิด (True/False)', points: 1, prompt: 'เซลล์สัตว์มีผนังเซลล์ (Cell Wall) ห่อหุ้มชั้นนอกสุดเหมือนเซลล์พืช', key: 'ผิด (False)' },
                { num: 3, type: 'เติมคำ (Fill in the blank)', points: 2, prompt: 'สารสีเขียวในพืชที่ทำหน้าที่ดูดกลืนพลังงานแสงเรียกว่าสารอะไร?', key: 'คลอโรฟิลล์ / chlorophyll' },
                { num: 4, type: 'จับคู่ (Matching)', points: 3, prompt: 'จับคู่ออร์แกเนลล์กับหน้าที่ให้ถูกต้อง (3 คู่)', key: 'นิวเคลียส, ไมโทคอนเดรีย, แวคิวโอล' },
                { num: 5, type: 'อัตนัย/บรรยาย (Essay)', points: 5, prompt: 'ให้นักเรียนอธิบายความแตกต่างที่สำคัญระหว่างเซลล์พืชและเซลล์สัตว์อย่างน้อย 3 ประการ', key: 'ตรวจโดยครูผู้สอน (เกณฑ์ Rubric)' },
              ].map((q) => (
                <div key={q.num} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 text-xs">ข้อที่ {q.num}</span>
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{q.type}</span>
                      <span className="text-[10px] text-slate-400">({q.points} คะแนน)</span>
                    </div>
                    <p className="text-sm text-slate-200">{q.prompt}</p>
                    <p className="text-xs text-slate-400">
                      เฉลย: <span className="text-emerald-300 font-medium">{q.key}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ESSAY REVIEW */}
        {activeTab === 'essays' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">ตรวจข้อสอบอัตนัย (Essay Grading)</h2>
                <p className="text-xs text-slate-400">ตรวจคำตอบข้อเขียน ให้คะแนน พร้อมพิมพ์ข้อเสนอแนะให้นักเรียน</p>
              </div>
              <button
                onClick={() => alert('ประกาศคะแนนสุทธิให้นักเรียนทุกคนเรียบร้อยแล้ว!')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg"
              >
                📢 ประกาศคะแนนสุทธิให้นักเรียน
              </button>
            </div>

            <div className="space-y-4">
              {essaySubmissions.map((item, idx) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-sm font-bold text-white">{item.studentName}</span>
                      <span className="text-xs text-slate-400 ml-2">เลขประจำตัว: {item.studentId} • ห้อง {item.classroom}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      item.isGraded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {item.isGraded ? '✓ ตรวจแล้ว' : '⏳ รอการตรวจ'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-semibold">โจทย์: {item.question}</p>
                    <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 text-sm text-slate-200 whitespace-pre-line font-mono">
                      {item.studentResponse}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">คะแนนที่ได้ (เต็ม {item.maxPoints})</label>
                      <input
                        type="number"
                        step="0.5"
                        max={item.maxPoints}
                        min="0"
                        placeholder="เช่น 4.5"
                        defaultValue={item.awardedScore}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">คำแนะนำ / Feedback ของครู</label>
                      <input
                        type="text"
                        placeholder="พิมพ์คำแนะนำให้นักเรียน..."
                        defaultValue={item.feedback}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      onClick={() => alert(`บันทึกคะแนนของ ${item.studentName} เรียบร้อยแล้ว`)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition"
                    >
                      บันทึกคะแนน
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ANALYTICS & ITEM ANALYSIS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">คะแนนเฉลี่ย (Mean)</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">9.24 / 12</p>
                <span className="text-[10px] text-slate-500">คิดเป็น 77.0%</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">มัธยฐาน (Median)</span>
                <p className="text-2xl font-black text-white mt-1">9.50</p>
                <span className="text-[10px] text-slate-500">จุดกึ่งกลางคะแนน</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">ส่วนเบี่ยงเบน (S.D.)</span>
                <p className="text-2xl font-black text-blue-400 mt-1">1.85</p>
                <span className="text-[10px] text-slate-500">การกระจายตัวของคะแนน</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">คะแนนต่ำสุด (Min)</span>
                <p className="text-2xl font-black text-red-400 mt-1">4.50</p>
                <span className="text-[10px] text-slate-500">ห้อง ม.1/2</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">คะแนนสูงสุด (Max)</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">12.00</p>
                <span className="text-[10px] text-slate-500">ทำคะแนนเต็ม 3 คน</span>
              </div>
            </div>

            {/* Classical Test Theory Table */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">การวิเคราะห์คุณภาพข้อสอบรายข้อ (Item Analysis - CTT)</h3>
                <p className="text-xs text-slate-400">ประมวลผลด้วยเกณฑ์ 27% เคลลี่: ค่าความยากง่าย (p) และค่าอำนาจจำแนก (r)</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">ข้อที่</th>
                      <th className="py-2.5 px-3">ประเภท</th>
                      <th className="py-2.5 px-3">ค่าความยากง่าย (p)</th>
                      <th className="py-2.5 px-3">ค่าอำนาจจำแนก (r)</th>
                      <th className="py-2.5 px-3">การแปลความหมาย</th>
                      <th className="py-2.5 px-3">การวิเคราะห์ตัวลวง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 1</td>
                      <td className="py-3 px-3">ปรนัย</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">0.58</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.62</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          ยากง่ายพอเหมาะ • จำแนกดีมาก
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">ตัวลวงทำงานได้ดีเยี่ยม (กลุ่มอ่อนเลือกชอยส์ 3 มาก)</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 2</td>
                      <td className="py-3 px-3">ถูก/ผิด</td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-400">0.76</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.44</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                          ค่อนข้างง่าย • จำแนกดี
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">-</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 3</td>
                      <td className="py-3 px-3">เติมคำ</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">0.35</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.55</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                          ค่อนข้างยาก • จำแนกดีมาก
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">มีเด็กตอบสะกดผิดบางส่วน เช่น คลอโรฟิล</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 4</td>
                      <td className="py-3 px-3">จับคู่</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">0.52</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.48</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          ยากง่ายพอเหมาะ • จำแนกดีมาก
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">จับคู่สลับระหว่างนิวเคลียสกับไมโทคอนเดรีย 15%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. QR Code Modal */}
      {qrModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300">QR Code ประจำวิชา</span>
              <button onClick={() => setQrModal({ isOpen: false, accessCode: '', qrDataUrl: '' })} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-3 bg-white rounded-2xl inline-block shadow-inner">
              <img src={qrModal.qrDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
            </div>
            <div>
              <p className="text-xs text-slate-400">รหัสชุดข้อสอบ:</p>
              <p className="text-lg font-mono font-bold text-emerald-400">{qrModal.accessCode}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                ให้นักเรียนสแกนเพื่อเข้าสู่ห้องสอบวิชานี้ทันที
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/gateway/${qrModal.accessCode}`);
                alert('คัดลอกลิงก์สอบแล้ว!');
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
            >
              คัดลอกลิงก์สอบ (Direct URL)
            </button>
          </div>
        </div>
      )}

      {/* 5. Create Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-white">สร้างชุดข้อสอบใหม่</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">ชื่อชุดข้อสอบ *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สอบกลางภาคเรียนที่ 1/2569"
                  value={newExam.title}
                  onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">รหัสวิชา</label>
                  <input
                    type="text"
                    value={newExam.subjectCode}
                    onChange={(e) => setNewExam({ ...newExam, subjectCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">รหัสเข้าสอบ (Access Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น EXAM-BIO-01"
                    value={newExam.accessCode}
                    onChange={(e) => setNewExam({ ...newExam, accessCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ระยะเวลาสอบ (นาที)</label>
                  <input
                    type="number"
                    value={newExam.durationMinutes}
                    onChange={(e) => setNewExam({ ...newExam, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">หลุดจอได้สูงสุด (ครั้ง)</label>
                  <input
                    type="number"
                    value={newExam.maxViolations}
                    onChange={(e) => setNewExam({ ...newExam, maxViolations: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  บันทึกและเปิดสอบ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
