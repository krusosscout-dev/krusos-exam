'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExamGateway } from '@/components/ExamGateway';
import { getExamByAccessCode, fetchExamsFromServer, shuffleArray, ExamRecord } from '@/services/examData';
import Link from 'next/link';

export default function GatewayPage({
  params,
}: {
  params: { accessCode: string };
}) {
  const router = useRouter();
  const { accessCode } = params;

  // ค้นหาชุดข้อสอบตามรหัสที่ส่งมาในลิงก์ (รองรับโหลดแบบแคช และซิงค์สดจากเซิร์ฟเวอร์ข้ามเบราว์เซอร์)
  const [exam, setExam] = useState<ExamRecord | undefined>(() => getExamByAccessCode(accessCode));

  useEffect(() => {
    fetchExamsFromServer().then((allExams) => {
      if (allExams && allExams.length > 0) {
        const found = allExams.find(
          (e) => e.accessCode.toUpperCase() === accessCode.trim().toUpperCase()
        );
        if (found) {
          setExam(found);
        }
      }
    });
  }, [accessCode]);

  const fallbackExam = {
    title: `แบบทดสอบรหัส ${accessCode.toUpperCase()}`,
    subjectCode: 'EXAM',
    subjectName: 'รายวิชาทั่วไป',
    durationMinutes: 60,
    classrooms: [
      { id: 'c1', gradeLevel: 'ม.1', roomNumber: '' },
      { id: 'c2', gradeLevel: 'ม.2', roomNumber: '' },
      { id: 'c3', gradeLevel: 'ม.3', roomNumber: '' },
    ],
  };

  const currentExam = exam || fallbackExam;

  const handleStartExam = async (studentData: {
    studentName: string;
    studentIdCard?: string;
    seatNumber: string;
    classroomId: string;
  }) => {
    try {
      // 0. ตรวจสอบสถานะการเปิด/ปิดรับคำตอบ
      if (typeof window !== 'undefined') {
        const isClosedInStorage = localStorage.getItem(`exam_closed_${accessCode.toUpperCase()}`) === 'true';
        if (isClosedInStorage || (exam && exam.isOpen === false)) {
          return {
            success: false,
            errorMessage: '🔒 ขณะนี้แบบทดสอบนี้ได้ปิดรับคำตอบแล้ว กรุณาติดต่อคุณครูผู้สอนหากมีเหตุจำเป็น',
          };
        }
      }

      // 1. บังคับให้สอบได้เพียงคนละ 1 ครั้งเท่านั้น
      if (typeof window !== 'undefined') {
        const hasCard = studentData.studentIdCard && studentData.studentIdCard.trim() !== '-' && studentData.studentIdCard.trim() !== '';
        const studentIdentifier = hasCard
          ? studentData.studentIdCard!.trim()
          : `${studentData.classroomId}_${studentData.seatNumber ? `no${studentData.seatNumber.trim()}` : studentData.studentName.trim()}`;

        const submittedKey = `submitted_${accessCode.toUpperCase()}_${studentIdentifier}`;
        if (localStorage.getItem(submittedKey)) {
          const displayLabel = hasCard
            ? `เลขประจำตัว "${studentData.studentIdCard}"`
            : `นักเรียน "${studentData.studentName}"`;
          return {
            success: false,
            errorMessage: `⚠️ ไม่อนุญาตให้สอบซ้ำ: ${displayLabel} ได้ทำการส่งข้อสอบชุดนี้เรียบร้อยแล้ว (จำกัดสิทธิ์การสอบคนละ 1 ครั้งเท่านั้น หากมีเหตุขัดข้องกรุณาติดต่อคุณครูผู้สอน)`,
          };
        }
      }

      // 2. สลับข้อสอบและสลับตัวเลือกแบบสุ่ม (Shuffle) เพื่อป้องกันการลอกกัน
      let processedQuestions = [...((exam && exam.questions) || [])];
      if (exam?.shuffleQuestions) {
        processedQuestions = shuffleArray(processedQuestions);
      }
      if (exam?.shuffleChoices) {
        processedQuestions = processedQuestions.map((q) => {
          if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.optionsPayload)) {
            return {
              ...q,
              optionsPayload: shuffleArray(q.optionsPayload),
            };
          }
          return q;
        });
      }

      // 3. สร้าง Session ID เฉพาะสำหรับการสอบครั้งนี้
      const studentTag = (studentData.studentIdCard && studentData.studentIdCard.trim() !== '-')
        ? studentData.studentIdCard.trim()
        : (studentData.seatNumber?.trim() || 'std');
      const demoSessionId = `sess_${Date.now()}_${studentTag}`;
      
      const sessionPayload = {
        sessionId: demoSessionId,
        studentData,
        accessCode: accessCode.toUpperCase(),
        examTitle: currentExam.title,
        subjectName: `${currentExam.subjectCode} ${currentExam.subjectName}`,
        durationMinutes: currentExam.durationMinutes,
        maxViolations: (exam && exam.maxViolations) || 3,
        questions: processedQuestions,
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
      {/* Top Info Bar พร้อมปุ่มย้อนกลับหน้าหลัก */}
      <div className="max-w-lg w-full mx-auto pt-4 flex items-center justify-between text-xs text-slate-400">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition duration-200 shadow-sm group font-medium"
        >
          <span className="text-base leading-none transition-transform group-hover:-translate-x-0.5">‹</span>
          <span>ย้อนกลับหน้าหลัก</span>
        </Link>
        <span className="font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-emerald-400 font-semibold">
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
