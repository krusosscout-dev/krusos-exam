'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExamGateway } from '@/components/ExamGateway';

export default function GatewayPage({
  params,
}: {
  params: { accessCode: string };
}) {
  const router = useRouter();
  const { accessCode } = params;

  // Mock classroom list for demo/production binding
  const mockClassrooms = [
    { id: 'c1', gradeLevel: 'ม.1', roomNumber: '1' },
    { id: 'c2', gradeLevel: 'ม.1', roomNumber: '2' },
    { id: 'c3', gradeLevel: 'ม.1', roomNumber: '3' },
  ];

  const handleStartExam = async (studentData: {
    studentName: string;
    studentIdCard: string;
    seatNumber: string;
    classroomId: string;
  }) => {
    try {
      // In production: calls POST /api/exams/[accessCode]/start
      /*
      const res = await fetch(`/api/exams/${accessCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, errorMessage: data.message || 'ไม่สามารถเข้าสอบได้' };
      }
      sessionStorage.setItem(`exam_session_${accessCode}`, JSON.stringify(data));
      router.push(`/exam/${data.sessionId}`);
      */

      // Quick fallback demo session
      const demoSessionId = `sess_${Date.now()}`;
      sessionStorage.setItem(
        `exam_session_${demoSessionId}`,
        JSON.stringify({
          sessionId: demoSessionId,
          studentData,
          accessCode,
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
      );
      router.push(`/exam/${demoSessionId}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, errorMessage: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  };

  return (
    <ExamGateway
      accessCode={accessCode}
      examTitle="แบบทดสอบวัดผลการเรียนรู้กลางภาคเรียนที่ 1/2569"
      subjectCode="ว21101"
      subjectName="วิทยาศาสตร์และเทคโนโลยี 1"
      durationMinutes={60}
      classrooms={mockClassrooms}
      onStartExam={handleStartExam}
    />
  );
}
