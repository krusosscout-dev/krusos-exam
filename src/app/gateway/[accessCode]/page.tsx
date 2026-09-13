'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ExamGateway } from '@/components/ExamGateway';
import { getExamByAccessCode } from '@/services/examData';
import Link from 'next/link';

export default function GatewayPage({
  params,
}: {
  params: { accessCode: string };
}) {
  const router = useRouter();
  const { accessCode } = params;

  // ค้นหาชุดข้อสอบตามรหัสที่ส่งมาในลิงก์ (เช่น EXAM-SCI-01, EXAM-MATH-01)
  const exam = getExamByAccessCode(accessCode);

  const fallbackExam = {
    title: `แบบทดสอบรหัส ${accessCode.toUpperCase()}`,
    subjectCode: 'EXAM',
    subjectName: 'รายวิชาทั่วไป',
    durationMinutes: 60,
    classrooms: [
      { id: 'c1', gradeLevel: 'ม.1', roomNumber: '1' },
      { id: 'c2', gradeLevel: 'ม.1', roomNumber: '2' },
      { id: 'c3', gradeLevel: 'ม.1', roomNumber: '3' },
    ],
  };

  const currentExam = exam || fallbackExam;

  const handleStartExam = async (studentData: {
    studentName: string;
    studentIdCard: string;
    seatNumber: string;
    classroomId: string;
  }) => {
    try {
      // สร้าง Session ID เฉพาะสำหรับการสอบครั้งนี้
      const demoSessionId = `sess_${Date.now()}_${studentData.studentIdCard}`;
      
      const sessionPayload = {
        sessionId: demoSessionId,
        studentData,
        accessCode: accessCode.toUpperCase(),
        examTitle: currentExam.title,
        subjectName: `${currentExam.subjectCode} ${currentExam.subjectName}`,
        durationMinutes: currentExam.durationMinutes,
        maxViolations: (exam && exam.maxViolations) || 3,
        questions: (exam && exam.questions) || [],
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + currentExam.durationMinutes * 60 * 1000).toISOString(),
      };

      // บันทึกลง Client Session
      sessionStorage.setItem(`exam_session_${demoSessionId}`, JSON.stringify(sessionPayload));
      
      // นำนักเรียนเข้าสู่ห้องสอบทันที
      router.push(`/exam/${demoSessionId}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, errorMessage: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4">
      {/* Top Breadcrumb */}
      <div className="max-w-lg w-full mx-auto pt-4 flex items-center justify-between text-xs text-slate-400">
        <Link href="/" className="hover:text-emerald-400 transition flex items-center gap-1">
          ← กลับหน้าหลัก
        </Link>
        <span className="font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 text-emerald-400">
          รหัสข้อสอบ: {accessCode.toUpperCase()}
        </span>
      </div>

      {/* Gateway Card */}
      <div className="my-auto">
        <ExamGateway
          accessCode={accessCode.toUpperCase()}
          examTitle={currentExam.title}
          subjectCode={currentExam.subjectCode}
          subjectName={currentExam.subjectName}
          durationMinutes={currentExam.durationMinutes}
          classrooms={currentExam.classrooms}
          onStartExam={handleStartExam}
        />
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-600 pb-2">
        Krusos Smart Assessment • โรงเรียนวัดบางปูน
      </footer>
    </div>
  );
}
