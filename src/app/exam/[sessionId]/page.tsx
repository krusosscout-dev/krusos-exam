'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExamRoom } from '@/components/ExamRoom';
import { QuestionDefinition, StudentAnswerPayload } from '@/types/exam';

export default function StudentExamPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const { sessionId } = params;
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
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

  // Default fallback questions if session is empty
  const defaultQuestions: QuestionDefinition[] = [
    {
      id: 'q1',
      examId: 'ex-001',
      questionNumber: 1,
      type: 'MULTIPLE_CHOICE',
      promptText: 'โครงสร้างใดของเซลล์พืชทำหน้าที่สังเคราะห์แสงเพื่อสร้างอาหาร?',
      points: 1.0,
      optionsPayload: [
        { id: 'c1', text: 'ไรโบโซม (Ribosome)' },
        { id: 'c2', text: 'คลอโรพลาสต์ (Chloroplast)' },
        { id: 'c3', text: 'ไมโทคอนเดรีย (Mitochondria)' },
        { id: 'c4', text: 'กอลจิบอดี (Golgi Body)' },
      ],
      answerKey: 'c2',
    },
    {
      id: 'q2',
      examId: 'ex-001',
      questionNumber: 2,
      type: 'TRUE_FALSE',
      promptText: 'เซลล์สัตว์มีผนังเซลล์ (Cell Wall) ห่อหุ้มชั้นนอกสุดเหมือนเซลล์พืช',
      points: 1.0,
      answerKey: 'false',
    },
    {
      id: 'q3',
      examId: 'ex-001',
      questionNumber: 3,
      type: 'FILL_IN_BLANK',
      promptText: 'สารสีเขียวในพืชที่ทำหน้าที่ดูดกลืนพลังงานแสงเรียกว่าสารอะไร?',
      points: 2.0,
      answerKey: ['คลอโรฟิลล์', 'คลอโรฟิล', 'chlorophyll'],
    },
    {
      id: 'q4',
      examId: 'ex-001',
      questionNumber: 4,
      type: 'MATCHING',
      promptText: 'จับคู่ออร์แกเนลล์กับหน้าที่ให้ถูกต้อง',
      points: 3.0,
      optionsPayload: {
        left: [
          { id: 'l1', text: 'นิวเคลียส (Nucleus)' },
          { id: 'l2', text: 'ไมโทคอนเดรีย (Mitochondria)' },
          { id: 'l3', text: 'แวคิวโอล (Vacuole)' },
        ],
        right: [
          { id: 'r1', text: 'แหล่งสร้างพลังงาน ATP ของเซลล์' },
          { id: 'r2', text: 'ควบคุมกิจกรรมภายในเซลล์และเก็บสารพันธุกรรม' },
          { id: 'r3', text: 'กักเก็บน้ำ สารอาหาร และของเสีย' },
        ],
      },
      answerKey: { l1: 'r2', l2: 'r1', l3: 'r3' },
    },
    {
      id: 'q5',
      examId: 'ex-001',
      questionNumber: 5,
      type: 'ESSAY',
      promptText: 'ให้นักเรียนอธิบายความแตกต่างที่สำคัญระหว่างเซลล์พืชและเซลล์สัตว์อย่างน้อย 3 ประการ พร้อมยกตัวอย่างหน้าที่สำคัญ',
      points: 5.0,
    },
  ];

  const questionsToUse = (sessionData?.questions && sessionData.questions.length > 0)
    ? sessionData.questions
    : defaultQuestions;

  const handleSubmit = async (answers: StudentAnswerPayload[], isForced: boolean) => {
    try {
      const accessCode = sessionData?.accessCode || 'EXAM-SCI-01';
      const res = await fetch(`/api/exams/${accessCode}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers,
          isForcedSubmission: isForced,
        }),
      });

      const data = await res.json();
      setSubmissionResult(data.data || {
        autoGradedScore: 0,
        status: isForced ? 'FORCE_TERMINATED' : 'SUBMITTED',
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      setIsSubmitted(true);
    }
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-white">ส่งคำตอบเรียบร้อยแล้ว</h2>
          <p className="text-slate-400 text-xs">
            นักเรียน: <span className="text-white font-medium">{sessionData?.studentData?.studentName || 'ผู้เข้าสอบ'}</span> ({sessionData?.studentData?.studentIdCard || '-'})
          </p>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-left space-y-1 text-xs">
            <p className="text-slate-400">สถานะการสอบ:</p>
            <p className="text-sm font-bold text-emerald-400">
              {submissionResult?.status === 'FORCE_TERMINATED'
                ? '⚠️ ถูกบังคับส่ง (เกินเกณฑ์ความปลอดภัย)'
                : '✓ บันทึกคำตอบลงระบบกลางเรียบร้อย'}
            </p>
            <p className="text-slate-400 pt-2 border-t border-slate-700/60">
              * สำหรับข้อสอบอัตนัย คุณครูผู้สอนจะทำการตรวจและประกาศคะแนนสุทธิต่อไป
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition text-xs"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <ExamRoom
      examTitle={sessionData?.examTitle || 'แบบทดสอบวัดผลการเรียนรู้'}
      subjectName={sessionData?.subjectName || 'วิทยาศาสตร์และเทคโนโลยี 1 (ว21101)'}
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
