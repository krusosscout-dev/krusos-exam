'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    const studentCard = sessionData?.studentData?.studentIdCard || '0000';
    const studentName = sessionData?.studentData?.studentName || 'ผู้เข้าสอบ';
    const classroom = sessionData?.studentData?.classroomId || 'ม.1/1';
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
      const submittedKey = `submitted_${accessCode.toUpperCase()}_${studentCard.trim()}`;
      localStorage.setItem(submittedKey, new Date().toISOString());

      // 3. บันทึกผลคะแนนลงฐานข้อมูลกลางฝั่ง Client เพื่อให้ครูดูในหน้าแอดมิน
      const existingResultsStr = localStorage.getItem('krusos_student_results') || '[]';
      try {
        const results = JSON.parse(existingResultsStr);
        const newRecord = {
          id: `rec_${Date.now()}`,
          accessCode: accessCode.toUpperCase(),
          studentId: studentCard,
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
        const filtered = results.filter((r: any) => !(r.accessCode === accessCode.toUpperCase() && r.studentId === studentCard));
        filtered.push(newRecord);
        localStorage.setItem('krusos_student_results', JSON.stringify(filtered));
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 text-center select-none font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">ส่งข้อสอบเรียบร้อยแล้ว</h2>
            <p className="text-slate-400 text-xs mt-1">
              ผู้สอบ: <strong className="text-slate-200">{sessionData?.studentData?.studentName || 'นักเรียน'}</strong> ({sessionData?.studentData?.studentIdCard || '-'}) ห้อง {sessionData?.studentData?.classroomId || 'ม.1/1'}
            </p>
          </div>

          {/* กล่องแสดงคะแนนตามเงื่อนไข: บอกคะแนนเฉพาะ ปรนัย จับคู่ ถูกผิด และส่วนเสริมบอกแค่ ผ่าน/ไม่ผ่าน */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left space-y-3">
            {/* ส่วนที่ 1: คะแนนปรนัย / จับคู่ / ถูกผิด */}
            <div className="border-b border-slate-700/80 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  คะแนนข้อสอบปรนัย / จับคู่ / ถูกผิด
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

            {/* ส่วนที่ 2: คะแนนเสริม (อัตนัย/การประเมินอื่น) บอกแค่ ผ่าน หรือ ไม่ผ่าน */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  การประเมินคะแนนเสริม (อัตนัย/เขียนตอบ)
                </span>
                <span className="text-[10px] text-slate-400">
                  เกณฑ์ผ่าน/ไม่ผ่าน
                </span>
              </div>
              <div className="mt-2">
                {gradingSummary?.supplementaryStatus === 'PASS' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold">
                    <span>✓</span> ผ่านเกณฑ์ประเมินเสริม
                  </div>
                )}
                {gradingSummary?.supplementaryStatus === 'FAIL' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold">
                    <span>✕</span> ต้องปรับปรุง (ไม่ผ่าน)
                  </div>
                )}
                {gradingSummary?.supplementaryStatus === 'PENDING' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold">
                    <span>⏳</span> อยู่ระหว่างรอคุณครูตรวจข้อเขียน
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* คำเตือนเรื่อง 1 สิทธิ์ */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left">
            🔒 <strong className="text-slate-300">แจ้งเตือน:</strong> ระบบได้บันทึกการส่งข้อสอบและล็อกสิทธิ์เรียบร้อยแล้ว (ไม่สามารถเข้าสอบซ้ำได้)
          </div>

          {/* ปุ่มเสร็จสิ้นและออกจากระบบ */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                // พยายามปิดแท็บเบราว์เซอร์
                if (typeof window !== 'undefined') {
                  window.close();
                  // หากเบราว์เซอร์บล็อกการปิดแท็บอัตโนมัติ ให้แจ้งข้อความยืนยัน
                  alert('✓ บันทึกผลสอบเรียบร้อยแล้ว คุณสามารถปิดหน้าต่างเบราว์เซอร์หรือปิดแอปพลิเคชันนี้ได้ทันที');
                }
              }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition text-xs sm:text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span>เสร็จสิ้นและออกจากระบบ (ปิดหน้านี้)</span>
              <span>🚪</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center font-normal">
              * ข้อมูลคะแนนถูกบันทึกเรียบร้อย สามารถปิดแท็บหรือเบราว์เซอร์นี้ได้เลยครับ
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ExamRoom
      examTitle={sessionData?.examTitle || 'แบบทดสอบวัดผลการเรียนรู้'}
      subjectName={sessionData?.subjectName || 'สังคมศึกษา ศาสนา และวัฒนธรรม 1 (ส21101)'}
      studentName={sessionData?.studentData?.studentName || 'นักเรียน'}
      studentIdCard={sessionData?.studentData?.studentIdCard || '54321'}
      classroomLabel={sessionData?.studentData?.classroomId || 'ม.1/1'}
      sessionId={sessionId}
      expiresAt={sessionData?.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      maxViolations={sessionData?.maxViolations || 3}
      questions={questionsToUse}
      onSubmitExam={handleSubmit}
    />
  );
}
