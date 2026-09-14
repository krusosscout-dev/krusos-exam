'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExamRoom } from '@/components/ExamRoom';
import { QuestionDefinition, StudentAnswerPayload } from '@/types/exam';
import { gradeStudentSubmission } from '@/services/gradingEngine';

export default function StudentExamPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const { sessionId } = params;
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [gradingSummary, setGradingSummary] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);

  // โหลดข้อมูล Session ที่นักเรียนกรอกมาจากหน้า Gateway
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`exam_session_${sessionId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSessionData(parsed);
        } catch (e) {
          console.error('Session parse error:', e);
        }
      }
      setIsLoading(false);
    }
  }, [sessionId]);

  const defaultQuestions: QuestionDefinition[] = [
    {
      id: 'sq1',
      examId: 'ex-soc-01',
      questionNumber: 1,
      type: 'MULTIPLE_CHOICE',
      promptText: 'กฎหมายสูงสุดในการปกครองประเทศไทยคือข้อใด?',
      points: 1.0,
      answerKey: 'c2',
    },
    {
      id: 'sq2',
      examId: 'ex-soc-01',
      questionNumber: 2,
      type: 'TRUE_FALSE',
      promptText: 'บุคคลทุกคนมีหน้าที่ต้องไปใช้สิทธิเลือกตั้งตามที่รัฐธรรมนูญบัญญัติไว้',
      points: 1.0,
      answerKey: 'true',
    },
  ];

  const questionsToUse = (sessionData?.questions && sessionData.questions.length > 0)
    ? sessionData.questions
    : defaultQuestions;

  const handleSubmit = async (answers: StudentAnswerPayload[], isForced: boolean) => {
    const accessCode = sessionData?.accessCode || 'EXAM-SOC-01';
    const rawStudentCard = sessionData?.studentData?.studentIdCard?.trim();
    const hasCard = rawStudentCard && rawStudentCard !== '-';
    const studentCard = hasCard ? rawStudentCard : '-';
    const studentName = sessionData?.studentData?.studentName || 'ผู้เข้าสอบ';
    const classroom = (sessionData?.studentData?.classroomId || 'ม.1').replace(/\/.*$/, '');
    const seatNumber = sessionData?.studentData?.seatNumber || '-';

    // 1. คำนวณคะแนนผ่าน Grading Engine ตามกฎ:
    // - แสดงคะแนนเฉพาะ ปรนัย (MCQ), จับคู่ (Matching), ถูก/ผิด (True/False)
    // - ข้อสอบประเภทอื่น (อัตนัย/เติมคำ) ประเมินเป็นส่วนเสริม "ผ่าน" / "ไม่ผ่าน"
    const summary = gradeStudentSubmission(
      sessionId,
      questionsToUse,
      answers,
      isForced
    );
    setGradingSummary(summary);

    if (typeof window !== 'undefined') {
      // 2. บันทึกสิทธิ์การสอบ: ล็อกให้สอบได้เพียงคนละ 1 ครั้งเท่านั้น
      const studentIdentifier = hasCard
        ? studentCard
        : `${classroom}_${seatNumber !== '-' ? `no${seatNumber}` : studentName.trim()}`;
      const submittedKey = `submitted_${accessCode.toUpperCase()}_${studentIdentifier}`;
      localStorage.setItem(submittedKey, new Date().toISOString());

      // 3. บันทึกผลคะแนนลงฐานข้อมูลกลางฝั่ง Client เพื่อให้ครูดูในหน้าแอดมิน
      const existingResultsStr = localStorage.getItem('krusos_student_results') || '[]';
      try {
        const results = JSON.parse(existingResultsStr);
        const newRecord = {
          id: `rec_${Date.now()}`,
          accessCode: accessCode.toUpperCase(),
          studentId: hasCard ? studentCard : (seatNumber !== '-' ? `เลขที่ ${seatNumber}` : '-'),
          studentName,
          classroom,
          seatNumber,
          submittedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          objectiveScore: summary.objectiveScore,
          objectiveMaxPoints: summary.objectiveMaxPoints,
          supplementaryStatus: summary.supplementaryStatus,
          status: isForced ? 'FORCE_TERMINATED' : summary.status,
          totalScore: summary.totalScore,
        };
        // อัปเดตหรือเพิ่มผลสอบ
        const filtered = results.filter((r: any) => !(r.accessCode === accessCode.toUpperCase() && ((hasCard && r.studentId === studentCard) || (!hasCard && r.studentName === studentName && r.classroom === classroom))));
        filtered.push(newRecord);
        localStorage.setItem('krusos_student_results', JSON.stringify(filtered));

        // ส่งผลสอบขึ้นเซิร์ฟเวอร์แบบเรียลไทม์ เพื่อให้ครูผู้สอนเห็นคะแนนทันทีในแดชบอร์ด
        fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: newRecord }),
        }).catch((err) => console.warn('Sync result to server warning:', err));
      } catch (e) {
        console.error('Error saving score to local registry:', e);
      }
    }

    setIsSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        กำลังจัดเตรียมห้องสอบส่วนบุคคล...
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-6 text-center select-none font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl space-y-4 my-auto">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">ส่งข้อสอบเรียบร้อยแล้ว</h2>
            <p className="text-slate-400 text-xs mt-1">
              ผู้สอบ: <strong className="text-slate-200">{sessionData?.studentData?.studentName || 'นักเรียน'}</strong>
              {sessionData?.studentData?.seatNumber ? ` (เลขที่ ${sessionData.studentData.seatNumber})` : ''}
              {sessionData?.studentData?.studentIdCard && sessionData.studentData.studentIdCard !== '-' ? ` [รหัส: ${sessionData.studentData.studentIdCard}]` : ''}
              {' '}ชั้น {(sessionData?.studentData?.classroomId || 'ม.1').replace(/\/.*$/, '')}
            </p>
          </div>

          {/* กล่องแสดงคะแนน: คะแนนข้อสอบปรนัยตรวจทันที + ข้อสอบอัตนัยรอครูตรวจให้คะแนน (ไม่มีคำว่าผ่าน/ไม่ผ่าน) */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left space-y-3.5">
            {/* ส่วนที่ 1: คะแนนปรนัย / จับคู่ / ถูกผิด / เติมคำ */}
            <div className="border-b border-slate-700/80 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  คะแนนข้อสอบปรนัย / จับคู่ / ถูกผิด / เติมคำ
                </span>
                <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                  ตรวจทันที
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-3xl font-black text-white font-mono">
                  {gradingSummary?.objectiveScore ?? 0}
                </span>
                <span className="text-slate-400 text-xs font-semibold">
                  / {gradingSummary?.objectiveMaxPoints ?? 0} คะแนน
                </span>
              </div>
            </div>

            {/* ส่วนที่ 2: ข้อสอบอัตนัย (ข้อเขียน) - รอคุณครูตรวจให้คะแนน */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <span>✍️</span> ข้อสอบอัตนัย (ข้อเขียน)
                </span>
                <span className="text-[11px] text-amber-400/90 font-mono font-medium">
                  {gradingSummary?.essayMaxPoints ? `คะแนนเต็ม ${gradingSummary.essayMaxPoints} คะแนน` : 'รอตรวจให้คะแนน'}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold">
                  <span className="animate-pulse">⏳</span> อยู่ระหว่างรอคุณครูตรวจให้คะแนน
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  * ข้อเขียนส่วนนี้คุณครูผู้สอนจะเป็นผู้ตรวจคำตอบและบันทึกคะแนนในระบบภายหลังครับ
                </p>
              </div>
            </div>
          </div>

          {/* คำเตือนเรื่อง 1 สิทธิ์ */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left">
            🔒 <strong className="text-slate-300">แจ้งเตือน:</strong> ระบบได้บันทึกการส่งข้อสอบและล็อกสิทธิ์เรียบร้อยแล้ว (ไม่สามารถเข้าสอบซ้ำได้)
          </div>

          {/* ปุ่มเสร็จสิ้นและออกจากระบบ */}
          <div className="space-y-2 pt-1">
            <Link
              href="/"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition text-xs sm:text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>🏠 กลับสู่หน้าหลักระบบสอบ</span>
            </Link>

            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.close();
                }
                setShowExitModal(true);
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl transition text-xs border border-slate-700/80 flex items-center justify-center gap-1.5"
            >
              <span>ปิดหน้าต่างนี้</span>
              <span>🚪</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center font-normal">
              * ข้อมูลคะแนนถูกบันทึกเรียบร้อย สามารถกลับหน้าหลักหรือปิดแท็บได้เลยครับ
            </p>
          </div>
        </div>

        {/* ป๊อปอัปแจ้งเตือนโมเดิร์นเมื่อกดออกจากระบบ (แทนที่ browser alert) */}
        {showExitModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-lg">
                ✓
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-white">บันทึกผลสอบเรียบร้อยแล้ว</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ระบบได้บันทึกคะแนนและล็อกสิทธิ์การสอบของคุณเรียบร้อยแล้ว คุณสามารถปิดหน้าต่างเบราว์เซอร์หรือแท็บนี้ได้ทันทีครับ
                </p>
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.close();
                  }
                  setShowExitModal(false);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-900/40"
              >
                รับทราบและปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ExamRoom
      examTitle={sessionData?.examTitle || 'แบบทดสอบวัดผลการเรียนรู้'}
      subjectName={sessionData?.subjectName || 'สังคมศึกษา ศาสนา และวัฒนธรรม 1 (ส21101)'}
      studentName={sessionData?.studentData?.studentName || 'นักเรียน'}
      studentIdCard={sessionData?.studentData?.studentIdCard || ''}
      classroomLabel={(sessionData?.studentData?.classroomId || 'ม.1').replace(/\/.*$/, '')}
      sessionId={sessionId}
      expiresAt={sessionData?.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      maxViolations={sessionData?.maxViolations || 3}
      questions={questionsToUse}
      onSubmitExam={handleSubmit}
    />
  );
}
