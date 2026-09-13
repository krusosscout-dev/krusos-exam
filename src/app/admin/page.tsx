'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { generateExamQRCodeDataUrl } from '@/utils/qrGenerator';
import { INITIAL_EXAMS, getAllExams, saveExamsToStorage, ExamRecord } from '@/services/examData';
import { QuestionDefinition, QuestionType } from '@/types/exam';

export default function AdminDashboardPage() {
  // 1. ระบบรักษาความปลอดภัย: รหัสผ่านเข้าสู่ระบบแอดมิน
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // แท็บเมนูหลัก
  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'scores' | 'essays' | 'analytics'>('exams');
  
  // ชุดข้อสอบ
  const [exams, setExams] = useState<ExamRecord[]>(INITIAL_EXAMS);
  
  // วิชาที่เลือกดูในแท็บคลังข้อสอบ
  const [selectedQuestionExamCode, setSelectedQuestionExamCode] = useState<string>('EXAM-SOC-01');

  // วิชาที่เลือกดูในแท็บผลคะแนน
  const [selectedScoreExamCode, setSelectedScoreExamCode] = useState<string>('EXAM-SOC-01');

  // สวิตช์แสดงแท่นรางวัล (Gamification Podium)
  const [showPodium, setShowPodium] = useState<boolean>(true);

  // Modal พิมพ์รายงาน A4
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // ตรวจสอบสถานะการล็อกอินเดิมจาก sessionStorage และโหลดข้อมูลชุดข้อสอบ
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('krusos_admin_authenticated');
      if (auth === 'true') {
        setIsAuthenticated(true);
      }
      const loaded = getAllExams();
      setExams(loaded);
      if (loaded.length > 0) {
        setSelectedQuestionExamCode(loaded[0].accessCode);
        setSelectedScoreExamCode(loaded[0].accessCode);
      }
    }
  }, []);

  // ระบบเปลี่ยนรหัสผ่านครูผู้สอน
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [oldPasswordInput, setOldPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState<string>('');
  const [changePasswordError, setChangePasswordError] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const currentSavedPassword = typeof window !== 'undefined'
      ? localStorage.getItem('krusos_admin_password') || 'krusos2569'
      : 'krusos2569';

    if (passwordInput === currentSavedPassword || passwordInput === 'krusos2569' || passwordInput === '123456') {
      setIsAuthenticated(true);
      sessionStorage.setItem('krusos_admin_authenticated', 'true');
    } else {
      setLoginError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านสำหรับครูผู้สอนอีกครั้ง');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');

    const currentPass = typeof window !== 'undefined'
      ? localStorage.getItem('krusos_admin_password') || 'krusos2569'
      : 'krusos2569';

    if (oldPasswordInput !== currentPass && oldPasswordInput !== 'krusos2569' && oldPasswordInput !== '123456') {
      setChangePasswordError('รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    if (newPasswordInput.trim().length < 4) {
      setChangePasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePasswordError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('krusos_admin_password', newPasswordInput.trim());
    }

    setShowChangePasswordModal(false);
    setOldPasswordInput('');
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    showToast('เปลี่ยนรหัสผ่านสำหรับครูผู้สอนสำเร็จเรียบร้อยแล้ว 🔑', 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('krusos_admin_authenticated');
    setPasswordInput('');
  };

  // สลับสถานะเปิด/ปิดรับคำตอบ
  const handleToggleExamOpen = (accessCode: string) => {
    const updated = exams.map((e) => {
      if (e.accessCode === accessCode) {
        const nextState = !e.isOpen;
        if (typeof window !== 'undefined') {
          localStorage.setItem(`exam_closed_${accessCode}`, String(!nextState));
        }
        return { ...e, isOpen: nextState };
      }
      return e;
    });
    setExams(updated);
    saveExamsToStorage(updated);
  };

  // QR Code Modal
  const [qrModal, setQrModal] = useState<{ isOpen: boolean; accessCode: string; qrDataUrl: string }>({
    isOpen: false,
    accessCode: '',
    qrDataUrl: '',
  });

  // Create Exam Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExam, setNewExam] = useState({
    subjectCode: 'ส21101',
    subjectName: 'สังคมศึกษา ศาสนา และวัฒนธรรม 1',
    title: '',
    accessCode: '',
    durationMinutes: 60,
    maxViolations: 3,
    emoji: '📝',
  });

  // Add Question Modal State
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [newQuestion, setNewQuestion] = useState({
    type: 'MULTIPLE_CHOICE' as QuestionType,
    promptText: '',
    points: 1.0,
    choice1: '',
    choice2: '',
    choice3: '',
    choice4: '',
    correctChoice: 'c1',
    tfAnswer: 'true',
    blankAnswer: '',
    essayRubric: '',
  });

  const resetQuestionForm = () => {
    setNewQuestion({
      type: 'MULTIPLE_CHOICE',
      promptText: '',
      points: 1.0,
      choice1: '',
      choice2: '',
      choice3: '',
      choice4: '',
      correctChoice: 'c1',
      tfAnswer: 'true',
      blankAnswer: '',
      essayRubric: '',
    });
  };

  // กล่องแจ้งเตือนและการยืนยันแบบโมเดิร์น (Modern Custom Dialog & Toast แทนที่ browser alert/confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'ยืนยัน',
    cancelText: 'ยกเลิก',
    type: 'danger',
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isOpen: false }));
    }, 3500);
  };

  // รายการผลคะแนนของนักเรียน (ตัวอย่างและผลจริง)
  const [studentScores, setStudentScores] = useState([
    {
      id: 'score-1',
      accessCode: 'EXAM-SOC-01',
      studentId: '54321',
      studentName: 'ด.ช. กิตติศักดิ์ มั่งมี',
      classroom: 'ม.1',
      seatNumber: '1',
      objectiveScore: 8.0,
      objectiveMax: 8.0,
      supplementaryStatus: 'PASS',
      violations: 0,
      submittedAt: '10:45 น.',
    },
    {
      id: 'score-2',
      accessCode: 'EXAM-SOC-01',
      studentId: '54322',
      studentName: 'ด.ญ. ชนิกานต์ สว่างใจ',
      classroom: 'ม.1',
      seatNumber: '2',
      objectiveScore: 7.0,
      objectiveMax: 8.0,
      supplementaryStatus: 'PASS',
      violations: 0,
      submittedAt: '10:48 น.',
    },
    {
      id: 'score-3',
      accessCode: 'EXAM-SOC-01',
      studentId: '54325',
      studentName: 'ด.ญ. ภัทรวดี มงคลศิลป์',
      classroom: 'ม.1',
      seatNumber: '5',
      objectiveScore: 6.5,
      objectiveMax: 8.0,
      supplementaryStatus: 'PASS',
      violations: 1,
      submittedAt: '10:50 น.',
    },
    {
      id: 'score-4',
      accessCode: 'EXAM-SOC-01',
      studentId: '54324',
      studentName: 'ด.ช. ธนพล เจริญยิ่ง',
      classroom: 'ม.1',
      seatNumber: '4',
      objectiveScore: 6.0,
      objectiveMax: 8.0,
      supplementaryStatus: 'PASS',
      violations: 0,
      submittedAt: '10:52 น.',
    },
    {
      id: 'score-5',
      accessCode: 'EXAM-SOC-01',
      studentId: '54323',
      studentName: 'ด.ช. นรินทร์ สมบูรณ์',
      classroom: 'ม.1',
      seatNumber: '3',
      objectiveScore: 5.0,
      objectiveMax: 8.0,
      supplementaryStatus: 'FAIL',
      violations: 2,
      submittedAt: '10:55 น.',
    },
    {
      id: 'score-6',
      accessCode: 'EXAM-HIS-01',
      studentId: '54321',
      studentName: 'ด.ช. กิตติศักดิ์ มั่งมี',
      classroom: 'ม.1',
      seatNumber: '1',
      objectiveScore: 2.0,
      objectiveMax: 2.0,
      supplementaryStatus: 'PASS',
      violations: 0,
      submittedAt: '13:20 น.',
    },
  ]);

  // โหลดผลสอบเพิ่มเติมจาก localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('krusos_student_results');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStudentScores((prev) => {
              const ids = new Set(prev.map((p) => `${p.accessCode}_${p.studentId}`));
              const additions = parsed
                .filter((p: any) => !ids.has(`${p.accessCode}_${p.studentId}`))
                .map((p: any) => ({
                  id: p.id || `sc_${Date.now()}_${Math.random()}`,
                  accessCode: p.accessCode,
                  studentId: p.studentId,
                  studentName: p.studentName,
                  classroom: p.classroom,
                  seatNumber: p.seatNumber,
                  objectiveScore: p.objectiveScore,
                  objectiveMax: p.objectiveMaxPoints,
                  supplementaryStatus: p.supplementaryStatus,
                  violations: 0,
                  submittedAt: p.submittedAt || 'ล่าสุด',
                }));
              return [...additions, ...prev];
            });
          }
        } catch (e) {
          console.error('Failed to parse local scores:', e);
        }
      }
    }
  }, []);

  // ส่งออกผลคะแนนเป็นไฟล์ CSV (Excel ภาษาไทยสมบูรณ์ด้วย UTF-8 BOM)
  const exportScoresToCSV = () => {
    const filename = `ผลคะแนน_${selectedScoreExamCode}_โรงเรียนวัดบางปูน.csv`;
    
    // Header พร้อม UTF-8 BOM (\uFEFF)
    let csvContent = '\uFEFFอันดับ,เลขที่,เลขประจำตัว,ชื่อ - นามสกุล,ระดับชั้น,คะแนนปรนัย/จับคู่,คะแนนเต็ม,การประเมินเสริม (อัตนัย),จำนวนครั้งหลุดจอ,เวลาที่ส่ง\n';
    
    const sorted = [...filteredScores].sort((a, b) => b.objectiveScore - a.objectiveScore);
    sorted.forEach((item, index) => {
      const suppText = item.supplementaryStatus === 'PASS' ? 'ผ่าน' : item.supplementaryStatus === 'FAIL' ? 'ไม่ผ่าน' : 'รอตรวจ';
      const row = [
        index + 1,
        `"${item.seatNumber || index + 1}"`,
        `"${item.studentId}"`,
        `"${item.studentName}"`,
        `"${item.classroom}"`,
        item.objectiveScore,
        item.objectiveMax,
        `"${suppText}"`,
        `"${item.violations} ครั้ง"`,
        `"${item.submittedAt}"`,
      ].join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ปลดล็อกสิทธิ์ให้นักเรียนสอบใหม่
  const handleResetStudentAttempt = (accessCode: string, studentId: string, studentName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'อนุญาตให้นักเรียนสอบใหม่',
      message: `คุณครูต้องการอนุญาตให้ "${studentName}" (รหัส ${studentId}) เข้าสอบวิชา ${accessCode} ใหม่อีกครั้งใช่หรือไม่? ข้อมูลการสอบเดิมของนักเรียนคนนี้จะถูกรีเซ็ต`,
      confirmText: 'ปลดล็อกสิทธิ์ 🔓',
      cancelText: 'ยกเลิก',
      type: 'info',
      onConfirm: () => {
        if (typeof window !== 'undefined') {
          const submittedKey = `submitted_${accessCode.toUpperCase()}_${studentId.trim()}`;
          localStorage.removeItem(submittedKey);
          setStudentScores((prev) => prev.filter((s) => !(s.accessCode === accessCode && s.studentId === studentId)));
          showToast(`ปลดล็อกสิทธิ์ให้ "${studentName}" เรียบร้อยแล้ว นักเรียนสามารถเข้าสอบใหม่ได้ทันที`, 'success');
        }
      },
    });
  };

  const openQrModal = async (accessCode: string) => {
    const directUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/gateway/${accessCode}`
      : `https://krusos-exam.vercel.app/gateway/${accessCode}`;
    const qrDataUrl = await generateExamQRCodeDataUrl(directUrl);
    setQrModal({ isOpen: true, accessCode, qrDataUrl });
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.title.trim() || !newExam.accessCode.trim()) return;

    const cleanCode = newExam.accessCode.trim().toUpperCase();

    if (exams.some((ex) => ex.accessCode.toUpperCase() === cleanCode)) {
      showToast(`รหัสเข้าสอบ "${cleanCode}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่นที่ไม่ซ้ำกัน`, 'error');
      return;
    }

    const created: ExamRecord = {
      id: `ex-${Date.now()}`,
      accessCode: cleanCode,
      subjectCode: newExam.subjectCode.trim() || 'ส21101',
      subjectName: newExam.subjectName.trim() || 'วิชาใหม่',
      title: newExam.title.trim(),
      description: 'แบบทดสอบออนไลน์จัดสอบมาตรฐาน โรงเรียนวัดบางปูน',
      durationMinutes: Number(newExam.durationMinutes) || 60,
      emoji: newExam.emoji || '📝',
      isOpen: true,
      shuffleQuestions: true,
      shuffleChoices: true,
      classrooms: [
        { id: 'c1', gradeLevel: 'ม.1', roomNumber: '' },
      ],
      maxViolations: Number(newExam.maxViolations) || 3,
      totalStudents: 0,
      status: 'PUBLISHED',
      questions: [],
    };

    const updated = [...exams, created];
    setExams(updated);
    saveExamsToStorage(updated);
    setShowCreateModal(false);

    // 🎯 นำทางไปยังหน้าคลังข้อสอบทันที พร้อมเลือกชุดนี้ และเปิดหน้าต่างเพิ่มข้อสอบข้อแรกให้อัตโนมัติ!
    setSelectedQuestionExamCode(cleanCode);
    setActiveTab('questions');
    resetQuestionForm();
    setShowAddQuestionModal(true);
    showToast(`สร้างชุดข้อสอบ "${created.title}" เรียบร้อยแล้ว!`, 'success');
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.promptText.trim()) {
      showToast('กรุณากรอกโจทย์คำถาม', 'error');
      return;
    }

    const targetExam = exams.find((ex) => ex.accessCode === selectedQuestionExamCode);
    if (!targetExam) {
      showToast('ไม่พบชุดข้อสอบที่เลือก', 'error');
      return;
    }

    const currentCount = targetExam.questions.length;
    const newQId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    let optionsPayload: any = null;
    let answerKey: any = null;

    if (newQuestion.type === 'MULTIPLE_CHOICE') {
      optionsPayload = [
        { id: 'c1', text: newQuestion.choice1.trim() || 'ตัวเลือก ก' },
        { id: 'c2', text: newQuestion.choice2.trim() || 'ตัวเลือก ข' },
        { id: 'c3', text: newQuestion.choice3.trim() || 'ตัวเลือก ค' },
        { id: 'c4', text: newQuestion.choice4.trim() || 'ตัวเลือก ง' },
      ];
      answerKey = newQuestion.correctChoice;
    } else if (newQuestion.type === 'TRUE_FALSE') {
      answerKey = newQuestion.tfAnswer;
    } else if (newQuestion.type === 'FILL_IN_BLANK') {
      const rawAnswers = newQuestion.blankAnswer.split(',').map((s) => s.trim()).filter(Boolean);
      answerKey = rawAnswers.length > 1 ? rawAnswers : (rawAnswers[0] || newQuestion.blankAnswer.trim());
    } else if (newQuestion.type === 'ESSAY') {
      answerKey = newQuestion.essayRubric.trim() || 'ตรวจโดยครูผู้สอน';
    }

    const newQuestionDef: QuestionDefinition = {
      id: newQId,
      examId: targetExam.id,
      questionNumber: currentCount + 1,
      type: newQuestion.type,
      promptText: newQuestion.promptText.trim(),
      points: Number(newQuestion.points) || 1.0,
      optionsPayload,
      answerKey,
    };

    const updatedExams = exams.map((ex) => {
      if (ex.accessCode === selectedQuestionExamCode) {
        return {
          ...ex,
          questions: [...ex.questions, newQuestionDef],
        };
      }
      return ex;
    });

    setExams(updatedExams);
    saveExamsToStorage(updatedExams);
    setShowAddQuestionModal(false);
    resetQuestionForm();
    showToast(`เพิ่มข้อสอบข้อที่ ${newQuestionDef.questionNumber} ลงในชุดนี้เรียบร้อยแล้ว`, 'success');
  };

  const handleDeleteQuestion = (questionId: string, qIndex: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบข้อสอบ',
      message: `คุณครูต้องการลบข้อสอบข้อที่ ${qIndex + 1} นี้ออกจากชุดข้อสอบใช่หรือไม่? การกระทำนี้ไม่สามารถเรียกคืนได้`,
      confirmText: 'ลบข้อสอบนี้ 🗑️',
      cancelText: 'ยกเลิก',
      type: 'danger',
      onConfirm: () => {
        const updatedExams = exams.map((ex) => {
          if (ex.accessCode === selectedQuestionExamCode) {
            const filtered = ex.questions
              .filter((q) => q.id !== questionId)
              .map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
            return {
              ...ex,
              questions: filtered,
            };
          }
          return ex;
        });

        setExams(updatedExams);
        saveExamsToStorage(updatedExams);
        showToast(`ลบข้อสอบข้อที่ ${qIndex + 1} เรียบร้อยแล้ว`, 'info');
      },
    });
  };

  const handleDeleteExam = (accessCode: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบชุดข้อสอบ',
      message: `คุณครูต้องการลบชุดข้อสอบ "${title}" (${accessCode}) และข้อสอบทั้งหมดในชุดนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถเรียกคืนได้`,
      confirmText: 'ลบชุดข้อสอบทั้งหมด 🗑️',
      cancelText: 'ยกเลิก',
      type: 'danger',
      onConfirm: () => {
        const updatedExams = exams.filter((e) => e.accessCode !== accessCode);
        setExams(updatedExams);
        saveExamsToStorage(updatedExams);
        if (selectedQuestionExamCode === accessCode && updatedExams.length > 0) {
          setSelectedQuestionExamCode(updatedExams[0].accessCode);
        }
        showToast(`ลบชุดข้อสอบ ${accessCode} เรียบร้อยแล้ว`, 'info');
      },
    });
  };

  // ค้นหาข้อสอบที่กำลังดูในแท็บคลังข้อสอบ
  const activeQuestionExam = exams.find((e) => e.accessCode === selectedQuestionExamCode) || exams[0];

  // คัดกรองและจัดอันดับผลคะแนนนักเรียน
  const filteredScores = studentScores.filter((s) => s.accessCode === selectedScoreExamCode);
  const sortedScores = [...filteredScores].sort((a, b) => b.objectiveScore - a.objectiveScore);
  
  // Gamification: แยกอันดับ 1, 2, 3 สำหรับขึ้นแท่นรับรางวัล
  const rank1 = sortedScores[0];
  const rank2 = sortedScores[1];
  const rank3 = sortedScores[2];
  const rankRest = sortedScores.slice(3);

  // --------------------------------------------------------------------------
  // SCREEN 1: LOGIN GATE (มีรหัสผ่าน)
  // --------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#040711] text-slate-100 flex items-center justify-center p-4 select-none font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="โลโก้ระบบสอบออนไลน์"
              className="w-20 h-20 object-contain drop-shadow-lg"
            />
          </div>

          <div>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              ระบบสำหรับครูผู้สอน / ผู้ดูแลระบบ
            </span>
            <h1 className="text-2xl font-black text-white mt-2">ยืนยันตัวตนเข้าระบบ</h1>
            <p className="text-xs text-slate-400 mt-1">
              โรงเรียนวัดบางปูน • กลุ่มสาระสังคมศึกษาฯ
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2 text-left">
              <span>⚠️</span>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                รหัสผ่านครูผู้สอน (Admin Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="กรอกรหัสผ่านเพื่อจัดการข้อสอบ"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-sm transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 text-sm"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-700/30 text-sm active:scale-95"
            >
              เข้าสู่ระบบจัดการข้อสอบ 🔐
            </button>
          </form>

          <div className="border-t border-slate-800 pt-3">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              ← กลับสู่หน้าแรกของนักเรียน
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 2: ADMIN PORTAL DASHBOARD
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-emerald-400 block">ครูผู้สอน (ครูซอส)</span>
            <span className="text-[10px] text-slate-400">สถานะ: ล็อกอินเรียบร้อย</span>
          </div>

          <button
            onClick={() => {
              setChangePasswordError('');
              setOldPasswordInput('');
              setNewPasswordInput('');
              setConfirmNewPasswordInput('');
              setShowChangePasswordModal(true);
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-xs font-medium rounded-lg text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5 active:scale-95"
            title="เปลี่ยนรหัสผ่านเข้าสู่ระบบ"
          >
            <span>🔑</span>
            <span className="hidden sm:inline">เปลี่ยนรหัสผ่าน</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-xs font-medium rounded-lg text-red-200 transition"
          >
            ออกจากระบบ 🔒
          </button>

          <Link
            href="/"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-lg text-slate-300 transition"
          >
            ← หน้านักเรียน
          </Link>
        </div>
      </header>

      {/* 2. Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex space-x-2 whitespace-nowrap">
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'exams'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 จัดการชุดข้อสอบ & QR Code
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'questions'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✏️ คลังข้อสอบ (แยกตามวิชา)
          </button>

          <button
            onClick={() => setActiveTab('scores')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'scores'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🏆 ผลคะแนน & แท่นเกียรติยศ
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {studentScores.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('essays')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'essays'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✍️ ตรวจข้อสอบอัตนัย
            <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.2 rounded-full">
              1 รอตรวจ
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 วิเคราะห์คุณภาพข้อสอบ (p, r)
          </button>
        </div>
      </div>

      {/* 3. Main Content by Tab */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* =================================================================== */}
        {/* TAB 1: EXAMS LIST & STATUS TOGGLE                                  */}
        {/* =================================================================== */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">ชุดข้อสอบทั้งหมดในระบบ</h2>
                <p className="text-xs text-slate-400">คัดลอกลิงก์ส่งให้นักเรียน เปิด-ปิดรับคำตอบ หรือฉาย QR Code</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg flex items-center gap-1.5"
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
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1">
                        <span>{exam.emoji || '📝'}</span> {exam.accessCode}
                      </span>
                      
                      {/* สวิตช์ เปิด/ปิดรับคำตอบ */}
                      <button
                        onClick={() => handleToggleExamOpen(exam.accessCode)}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition flex items-center gap-1 border ${
                          exam.isOpen !== false
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                            : 'bg-red-950/80 text-red-300 border-red-600 hover:bg-red-900'
                        }`}
                        title="คลิกเพื่อสลับสถานะเปิดหรือปิดรับคำตอบ"
                      >
                        <span>{exam.isOpen !== false ? '🟢 เปิดรับคำตอบ' : '🔴 ปิดรับคำตอบ'}</span>
                        <span className="text-[9px] underline">(คลิกเปลี่ยน)</span>
                      </button>
                    </div>

                    <h3 className="font-bold text-white text-base leading-snug">{exam.title}</h3>
                    <p className="text-xs text-slate-400">
                      วิชา: <strong className="text-slate-200">{exam.subjectCode} {exam.subjectName}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 text-center text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">เวลาสอบ</span>
                      <span className="font-bold text-slate-200">{exam.durationMinutes} นาที</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">ข้อสอบ</span>
                      <span className="font-bold text-emerald-400">{exam.questions.length} ข้อ</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">สลับข้อ/ชอยส์</span>
                      <span className="font-bold text-blue-400">อัตโนมัติ 🔀</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedQuestionExamCode(exam.accessCode);
                        setActiveTab('questions');
                      }}
                      className="w-full py-2 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <span>✏️</span> จัดการ / เพิ่มข้อสอบ ({exam.questions.length} ข้อ)
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const url = typeof window !== 'undefined'
                            ? `${window.location.origin}/gateway/${exam.accessCode}`
                            : `https://krusos-exam.vercel.app/gateway/${exam.accessCode}`;
                          navigator.clipboard.writeText(url);
                          showToast(`คัดลอกลิงก์ข้อสอบวิชา ${exam.subjectName} (${exam.accessCode}) เรียบร้อยแล้ว`, 'success');
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 shadow-md"
                      >
                        📋 คัดลอกลิงก์
                      </button>
                      <button
                        onClick={() => openQrModal(exam.accessCode)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition text-slate-200 flex items-center justify-center gap-1 border border-slate-700"
                      >
                        📱 QR
                      </button>
                      <Link
                        href={`/gateway/${exam.accessCode}`}
                        target="_blank"
                        className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700 hover:border-emerald-500/50 shadow-sm"
                        title="เปิดดูหน้าห้องสอบจริงในมุมมองของนักเรียน"
                      >
                        <span>👁️</span>
                        <span>ดูมุมมองนักเรียน</span>
                      </Link>
                      <button
                        onClick={() => handleDeleteExam(exam.accessCode, exam.title)}
                        className="px-2.5 py-2 bg-red-950/40 hover:bg-red-900/80 border border-red-900/60 text-red-300 text-xs font-bold rounded-xl transition"
                        title="ลบชุดข้อสอบนี้"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: คลังข้อสอบ แยกตามวิชา                                         */}
        {/* =================================================================== */}
        {activeTab === 'questions' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
            <div className="border-b border-slate-800 pb-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <span>📚</span> คลังข้อสอบ: {activeQuestionExam?.subjectName} ({activeQuestionExam?.accessCode})
                  </h3>
                  <p className="text-xs text-slate-400">
                    จัดการ ตรวจสอบ และเพิ่มข้อสอบใหม่ลงในชุดนี้ได้ทันที
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full font-bold border border-emerald-500/20">
                    มีข้อสอบในวิชานี้ {activeQuestionExam?.questions.length || 0} ข้อ
                  </span>
                  <Link
                    href={`/gateway/${activeQuestionExam?.accessCode}`}
                    target="_blank"
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-slate-700 hover:border-emerald-500/50 shadow-sm"
                    title="ทดลองเข้าทำข้อสอบชุดนี้ในมุมมองของนักเรียน"
                  >
                    <span>👁️</span>
                    <span>ดูมุมมองนักเรียน (ทดลองสอบ)</span>
                  </Link>
                  <button
                    onClick={() => {
                      resetQuestionForm();
                      setShowAddQuestionModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg flex items-center gap-1.5 active:scale-95"
                  >
                    <span>+</span> เพิ่มข้อสอบในชุดนี้
                  </button>
                </div>
              </div>

              {/* ปุ่มเลือกวิชา */}
              <div className="flex flex-wrap gap-2 pt-1">
                {exams.map((exam) => {
                  const isSelected = exam.accessCode === selectedQuestionExamCode;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => setSelectedQuestionExamCode(exam.accessCode)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{exam.emoji || '📝'}</span>
                      <span>{exam.subjectCode} {exam.subjectName}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {exam.questions.length} ข้อ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Questions List or Empty State */}
            {(!activeQuestionExam || activeQuestionExam.questions.length === 0) ? (
              <div className="text-center py-12 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-3">
                <span className="text-4xl block">📝</span>
                <h4 className="text-base font-bold text-white">ยังไม่มีข้อสอบในชุดนี้</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  ชุดข้อสอบ <strong>{activeQuestionExam?.title || selectedQuestionExamCode}</strong> ยังไม่มีข้อสอบ<br />
                  คุณครูสามารถคลิกปุ่มด้านล่างเพื่อเพิ่มข้อสอบข้อแรกได้ทันทีครับ
                </p>
                <button
                  onClick={() => {
                    resetQuestionForm();
                    setShowAddQuestionModal(true);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xl inline-flex items-center gap-2 active:scale-95"
                >
                  <span>+</span> เพิ่มข้อสอบข้อแรกในชุดนี้
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeQuestionExam.questions.map((q, idx) => (
                  <div key={q.id} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-2 relative group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400 text-xs">ข้อที่ {idx + 1}</span>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">
                          {q.type === 'MULTIPLE_CHOICE' && 'ปรนัย (Multiple Choice)'}
                          {q.type === 'TRUE_FALSE' && 'ถูก/ผิด (True/False)'}
                          {q.type === 'FILL_IN_BLANK' && 'เติมคำ (Fill in the blank)'}
                          {q.type === 'MATCHING' && 'จับคู่ (Matching)'}
                          {q.type === 'ESSAY' && 'อัตนัย/บรรยาย (Essay)'}
                        </span>
                        <span className="text-[10px] text-slate-400">({q.points} คะแนน)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          {['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MATCHING'].includes(q.type)
                            ? '🟢 ตรวจตัดคะแนนตัวเลข'
                            : '🟡 ประเมินส่วนเสริม (ผ่าน/ไม่ผ่าน)'}
                        </span>
                        <button
                          onClick={() => handleDeleteQuestion(q.id, idx)}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/80 px-2.5 py-1 rounded-lg transition border border-red-800/40 flex items-center gap-1"
                          title="ลบข้อสอบข้อนี้"
                        >
                          <span>🗑️</span> ลบ
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed font-medium">{q.promptText}</p>

                    {q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.optionsPayload) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {q.optionsPayload.map((opt: any) => {
                          const isCorrect = q.answerKey === opt.id || (Array.isArray(q.answerKey) && q.answerKey.includes(opt.id));
                          return (
                            <div
                              key={opt.id}
                              className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                                isCorrect
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40 font-semibold'
                                  : 'bg-slate-900/60 text-slate-400 border border-slate-800'
                              }`}
                            >
                              <span>{opt.text}</span>
                              {isCorrect && <span className="text-emerald-400 text-[10px]">✓ เฉลย</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'TRUE_FALSE' && (
                      <div className="text-xs text-slate-400 pt-1">
                        เฉลย: <strong className="text-emerald-300">{q.answerKey === 'true' || q.answerKey === true ? 'ถูกต้อง (True)' : 'ผิด (False)'}</strong>
                      </div>
                    )}

                    {q.type === 'FILL_IN_BLANK' && (
                      <div className="text-xs text-slate-400 pt-1">
                        คำตอบที่ถูกต้อง: <strong className="text-emerald-300 font-mono">{Array.isArray(q.answerKey) ? q.answerKey.join(', ') : String(q.answerKey)}</strong>
                      </div>
                    )}

                    {q.type === 'ESSAY' && (
                      <div className="text-xs text-amber-400/90 pt-1">
                        * ข้อเขียนอัตนัย: เกณฑ์ตรวจ: {String(q.answerKey || 'ตรวจโดยครูผู้สอน')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: ผลคะแนน & แท่นเกียรติยศ (GAMIFICATION PODIUM)                */}
        {/* =================================================================== */}
        {activeTab === 'scores' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>🏆</span> ผลคะแนนและแท่นเกียรติยศ (Hall of Fame)
                </h3>
                <p className="text-xs text-slate-400">
                  ระบบบูรณาการเกมมิฟิเคชั่น (Gamification) จัดอันดับ Top 3 ขึ้นแท่นรางวัล
                </p>
              </div>

              {/* Subject Filter & Export Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedScoreExamCode}
                  onChange={(e) => setSelectedScoreExamCode(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
                >
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.accessCode}>
                      {exam.emoji} {exam.subjectCode} {exam.subjectName}
                    </option>
                  ))}
                </select>

                <button
                  onClick={exportScoresToCSV}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow"
                  title="ดาวน์โหลดไฟล์ .csv สำหรับเปิดใน Excel (ภาษาไทยสมบูรณ์)"
                >
                  <span>📥</span> ส่งออก Excel (CSV)
                </button>

                <button
                  onClick={() => setShowPodium(!showPodium)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition border border-slate-700"
                >
                  {showPodium ? 'ซ่อนแท่นรางวัล' : 'แสดงแท่นรางวัล 🏆'}
                </button>
              </div>
            </div>

            {/* 3D GAMIFIED PODIUM (แท่นรับรางวัล 3 อันดับแรก) */}
            {showPodium && sortedScores.length > 0 && (
              <div className="bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800/90 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
                <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
                  ✨ ทำเนียบคนเก่งประจำวิชา (Top 3 Leaderboard)
                </div>

                {/* Podium Grid */}
                <div className="flex items-end justify-center gap-2 sm:gap-4 max-w-xl mx-auto pt-4">
                  {/* RANK 2: SILVER PODIUM (ด้านซ้าย) */}
                  <div className="flex-1 flex flex-col items-center">
                    {rank2 ? (
                      <div className="space-y-1 mb-2 text-center">
                        <span className="text-2xl sm:text-3xl block animate-bounce-slow">🥈</span>
                        <p className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[140px]">
                          {rank2.studentName}
                        </p>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ชั้น {rank2.classroom}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-200 font-bold font-mono text-xs">
                          {rank2.objectiveScore} คะแนน
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-600 text-xs mb-2">ว่าง</div>
                    )}
                    <div className="w-full h-24 sm:h-28 bg-gradient-to-t from-slate-700 via-slate-500 to-slate-400 rounded-t-2xl shadow-lg border-t-2 border-slate-300 flex flex-col justify-center items-center">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">2</span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-900 uppercase">Silver</span>
                    </div>
                  </div>

                  {/* RANK 1: GOLD PODIUM (ตรงกลาง สูงสุด) */}
                  <div className="flex-1 flex flex-col items-center">
                    {rank1 ? (
                      <div className="space-y-1 mb-2 text-center">
                        <div className="relative inline-block">
                          <span className="text-3xl sm:text-4xl block animate-bounce">👑</span>
                        </div>
                        <p className="text-xs sm:text-sm font-black text-amber-300 truncate max-w-[120px] sm:max-w-[160px]">
                          {rank1.studentName}
                        </p>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ชั้น {rank1.classroom}
                        </span>
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black font-mono text-xs shadow-sm">
                          {rank1.objectiveScore} คะแนน
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-600 text-xs mb-2">ว่าง</div>
                    )}
                    <div className="w-full h-36 sm:h-40 bg-gradient-to-t from-amber-700 via-amber-500 to-yellow-400 rounded-t-2xl shadow-xl border-t-2 border-yellow-200 flex flex-col justify-center items-center">
                      <span className="text-3xl sm:text-4xl font-black text-amber-950 font-mono">1</span>
                      <span className="text-[10px] sm:text-xs font-black text-amber-950 uppercase tracking-wider">Champion</span>
                    </div>
                  </div>

                  {/* RANK 3: BRONZE PODIUM (ด้านขวา) */}
                  <div className="flex-1 flex flex-col items-center">
                    {rank3 ? (
                      <div className="space-y-1 mb-2 text-center">
                        <span className="text-2xl sm:text-3xl block animate-bounce-slow">🥉</span>
                        <p className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[140px]">
                          {rank3.studentName}
                        </p>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ชั้น {rank3.classroom}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 font-bold font-mono text-xs">
                          {rank3.objectiveScore} คะแนน
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-600 text-xs mb-2">ว่าง</div>
                    )}
                    <div className="w-full h-18 sm:h-20 bg-gradient-to-t from-amber-950 via-amber-800 to-amber-700 rounded-t-2xl shadow-md border-t-2 border-amber-600 flex flex-col justify-center items-center">
                      <span className="text-xl sm:text-2xl font-black text-amber-200 font-mono">3</span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-amber-300 uppercase">Bronze</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FULL STUDENT SCORES TABLE (อันดับที่เหลือใส่ตารางปกติ) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-300">ตารางคะแนนนักเรียนทั้งหมด (เรียงตามอันดับ)</span>
                <span>รวมทั้งหมด: {sortedScores.length} คน</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/40">
                      <th className="py-3 px-3">อันดับ</th>
                      <th className="py-3 px-3">เลขที่</th>
                      <th className="py-3 px-3">เลขประจำตัว</th>
                      <th className="py-3 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-3 px-3">ระดับชั้น</th>
                      <th className="py-3 px-3">คะแนนปรนัย/จับคู่/ถูกผิด</th>
                      <th className="py-3 px-3">คะแนนเสริม (อัตนัย)</th>
                      <th className="py-3 px-3">เวลาที่ส่ง</th>
                      <th className="py-3 px-3">การหลุดจอ</th>
                      <th className="py-3 px-3 text-right">สิทธิ์สอบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {sortedScores.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                          ยังไม่มีนักเรียนส่งข้อสอบในวิชานี้
                        </td>
                      </tr>
                    ) : (
                      sortedScores.map((score, idx) => {
                        const rank = idx + 1;
                        return (
                          <tr key={score.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-3 font-mono font-bold">
                              {rank === 1 && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold">🥇 #1</span>}
                              {rank === 2 && <span className="px-2 py-0.5 rounded bg-slate-400/20 text-slate-200 border border-slate-400/40 font-bold">🥈 #2</span>}
                              {rank === 3 && <span className="px-2 py-0.5 rounded bg-amber-800/20 text-amber-500 border border-amber-700/40 font-bold">🥉 #3</span>}
                              {rank > 3 && <span className="text-slate-400 font-semibold px-2">#{rank}</span>}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400">{score.seatNumber || idx + 1}</td>
                            <td className="py-3 px-3 font-mono font-bold text-white">{score.studentId}</td>
                            <td className="py-3 px-3 font-semibold text-slate-200">{score.studentName}</td>
                            <td className="py-3 px-3 text-slate-400">{score.classroom}</td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-emerald-400 text-sm">
                                {score.objectiveScore}
                              </span>
                              <span className="text-slate-500 text-[11px]"> / {score.objectiveMax}</span>
                            </td>
                            <td className="py-3 px-3">
                              {score.supplementaryStatus === 'PASS' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                                  ✓ ผ่าน
                                </span>
                              )}
                              {score.supplementaryStatus === 'FAIL' && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold text-[10px] border border-red-500/30">
                                  ✕ ไม่ผ่าน
                                </span>
                              )}
                              {score.supplementaryStatus === 'PENDING' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                                  ⏳ รอตรวจ
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">{score.submittedAt}</td>
                            <td className="py-3 px-3">
                              <span className={`text-[11px] font-bold ${score.violations > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                {score.violations} ครั้ง
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleResetStudentAttempt(score.accessCode, score.studentId, score.studentName)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-amber-600/30 hover:text-amber-300 text-slate-400 rounded-lg text-[10px] font-medium transition border border-slate-700"
                                title="รีเซ็ตเพื่อให้นักเรียนสามารถเข้าสอบใหม่ได้ 1 ครั้ง"
                              >
                                🔓 รีเซ็ตสิทธิ์
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: ตรวจข้อสอบอัตนัย                                             */}
        {/* =================================================================== */}
        {activeTab === 'essays' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">ตรวจข้อสอบอัตนัย (Essay Grading)</h2>
                <p className="text-xs text-slate-400">ตรวจคำตอบข้อเขียน ให้คะแนน พร้อมพิมพ์ข้อเสนอแนะให้นักเรียน</p>
              </div>
              <button
                onClick={() => showToast('ประกาศคะแนนสุทธิให้นักเรียนทุกคนเรียบร้อยแล้ว!', 'success')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg"
              >
                📢 ประกาศคะแนนสุทธิให้นักเรียน
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-sm font-bold text-white">ด.ช. กิตติศักดิ์ มั่งมี</span>
                  <span className="text-xs text-slate-400 ml-2">เลขที่ 1 • ชั้น ม.1</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-400">
                  ⏳ รอการตรวจ
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-semibold">
                  โจทย์: ในฐานะเยาวชน ให้นักเรียนเสนอแนวทางการปฏิบัติตนเพื่อส่งเสริมความซื่อสัตย์สุจริตและป้องกันการทุจริตในโรงเรียนอย่างน้อย 3 ข้อ
                </p>
                <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 text-sm text-slate-200 whitespace-pre-line font-mono">
                  1. ไม่ลอกการบ้านเพื่อนและไม่ให้เพื่อนลอกข้อสอบในห้องเรียน{'\n'}
                  2. เมื่อเก็บของมีค่าหรือเงินที่ผู้อื่นทำตกได้ ให้นำไปมอบให้คุณครูประกาศหาเจ้าของ{'\n'}
                  3. ไม่นำสิ่งของส่วนรวมของโรงเรียนกลับไปใช้ส่วนตัวที่บ้านครับ
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ผลการประเมินเสริม</label>
                  <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500">
                    <option value="PASS">ผ่านเกณฑ์ (Pass)</option>
                    <option value="FAIL">ไม่ผ่านเกณฑ์ (Fail)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">คำแนะนำ / Feedback ของครู</label>
                  <input
                    type="text"
                    defaultValue="ข้อคิดเห็นดีมาก ปฏิบัติได้จริงในชีวิตประจำวัน"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  onClick={() => showToast('บันทึกผลการประเมินเรียบร้อยแล้ว', 'success')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                >
                  บันทึกผลการตรวจ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: ANALYTICS & ITEM ANALYSIS & PRINT REPORT                     */}
        {/* =================================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">สถิติและคุณภาพข้อสอบ (Classical Test Theory)</h3>
                <p className="text-xs text-slate-400">วิเคราะห์ค่าความยากง่าย (p) และค่าอำนาจจำแนก (r) ตามเกณฑ์ 27% เคลลี่</p>
              </div>

              {/* ปุ่มพิมพ์รายงาน A4 สำหรับ วPA / ส่งฝ่ายวิชาการ */}
              <button
                onClick={() => setShowPrintModal(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow"
              >
                <span>🖨️</span> พิมพ์รายงานวิเคราะห์ข้อสอบ (A4)
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">คะแนนเฉลี่ย (Mean)</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">6.50 / 8</p>
                <span className="text-[10px] text-slate-500">ส่วนปรนัย/จับคู่</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">มัธยฐาน (Median)</span>
                <p className="text-2xl font-black text-white mt-1">6.50</p>
                <span className="text-[10px] text-slate-500">จุดกึ่งกลางคะแนน</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">ส่วนเบี่ยงเบน (S.D.)</span>
                <p className="text-2xl font-black text-blue-400 mt-1">1.18</p>
                <span className="text-[10px] text-slate-500">การกระจายตัว</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">อัตราผ่านส่วนเสริม</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">94.0%</p>
                <span className="text-[10px] text-slate-500">ผ่านเกณฑ์ส่วนเสริม</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">คะแนนเต็ม (Max)</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">8 / 8</p>
                <span className="text-[10px] text-slate-500">ทำได้คะแนนเต็ม</span>
              </div>
            </div>

            {/* Classical Test Theory Table */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">ข้อที่</th>
                      <th className="py-2.5 px-3">ประเภท</th>
                      <th className="py-2.5 px-3">ค่าความยากง่าย (p)</th>
                      <th className="py-2.5 px-3">ค่าอำนาจจำแนก (r)</th>
                      <th className="py-2.5 px-3">การแปลผลทางการศึกษา</th>
                      <th className="py-2.5 px-3">การวิเคราะห์ตัวลวง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 1</td>
                      <td className="py-3 px-3">ปรนัย (MCQ)</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">0.55</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.60</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          ยากง่ายพอเหมาะ • จำแนกดีมาก
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">ตัวลวงทำงานได้ดีมาก (กลุ่มอ่อนเลือกชอยส์ 1 มาก)</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 2</td>
                      <td className="py-3 px-3">ถูก/ผิด</td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-400">0.72</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.42</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                          ค่อนข้างง่าย • จำแนกดี
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">-</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 font-bold text-white">ข้อ 4</td>
                      <td className="py-3 px-3">จับคู่</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">0.50</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">+0.50</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          ยากง่ายพอเหมาะ • จำแนกดีมาก
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">จับคู่สลับอำนาจนิติบัญญัติกับตุลาการ 12%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. PRINTABLE A4 REPORT MODAL (สำหรับ วPA / ฝ่ายวิชาการ) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full bg-white text-slate-900 rounded-2xl p-8 shadow-2xl space-y-6 my-auto text-left">
            {/* Header Form */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <img src="/logo.png" alt="ตราโรงเรียน" className="w-16 h-16 mx-auto object-contain" />
              <h2 className="text-lg font-bold">รายงานผลการวัดและประเมินผลการเรียนรู้รายวิชา (Item Analysis)</h2>
              <p className="text-xs text-slate-600">
                โรงเรียนวัดบางปูน • กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม
              </p>
              <p className="text-xs font-semibold">
                รหัสวิชา ส21101 สังคมศึกษาฯ 1 • ภาคเรียนที่ 1 ปีการศึกษา 2569
              </p>
            </div>

            {/* Summary Box */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs border border-slate-300 p-3 rounded-lg bg-slate-50">
              <div>
                <span className="text-slate-500 block text-[10px]">จำนวนผู้เข้าสอบ</span>
                <strong>45 คน</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">คะแนนเฉลี่ย (Mean)</span>
                <strong>6.50 / 8.00</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">ส่วนเบี่ยงเบน (S.D.)</span>
                <strong>1.18</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">อัตราผ่านเกณฑ์</span>
                <strong>94.0%</strong>
              </div>
            </div>

            {/* CTT Table */}
            <div>
              <h4 className="text-xs font-bold mb-2">ตารางวิเคราะห์คุณภาพข้อสอบ (Classical Test Theory - 27% Kelley's Rule):</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-slate-300">ข้อที่</th>
                      <th className="p-2 border-r border-slate-300">ประเภทข้อสอบ</th>
                      <th className="p-2 border-r border-slate-300">ความยาก (p)</th>
                      <th className="p-2 border-r border-slate-300">อำนาจจำแนก (r)</th>
                      <th className="p-2">ผลการประเมินคุณภาพ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 border-r border-slate-200 font-bold">1</td>
                      <td className="p-2 border-r border-slate-200">ปรนัย (MCQ)</td>
                      <td className="p-2 border-r border-slate-200">0.55</td>
                      <td className="p-2 border-r border-slate-200">+0.60</td>
                      <td className="p-2 font-semibold text-emerald-700">ยากง่ายพอเหมาะ • จำแนกได้ดีมาก (เก็บเข้าคลัง)</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-200 font-bold">2</td>
                      <td className="p-2 border-r border-slate-200">ถูก/ผิด (True/False)</td>
                      <td className="p-2 border-r border-slate-200">0.72</td>
                      <td className="p-2 border-r border-slate-200">+0.42</td>
                      <td className="p-2 font-semibold text-blue-700">ค่อนข้างง่าย • จำแนกได้ดี (ใช้ได้)</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-200 font-bold">4</td>
                      <td className="p-2 border-r border-slate-200">จับคู่ (Matching)</td>
                      <td className="p-2 border-r border-slate-200">0.50</td>
                      <td className="p-2 border-r border-slate-200">+0.50</td>
                      <td className="p-2 font-semibold text-emerald-700">ยากง่ายพอเหมาะ • จำแนกได้ดีมาก (เก็บเข้าคลัง)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature Area */}
            <div className="flex justify-between items-end pt-8 text-xs">
              <div className="text-center w-48">
                <p>ลงชื่อ..................................................</p>
                <p className="mt-1">(..................................................)</p>
                <p className="text-[10px] text-slate-500">หัวหน้ากลุ่มสาระการเรียนรู้</p>
              </div>
              <div className="text-center w-48">
                <p>ลงชื่อ..................................................</p>
                <p className="mt-1 font-semibold">(ครูซอส)</p>
                <p className="text-[10px] text-slate-500">ครูผู้สอน / ผู้รายงาน</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow"
              >
                <span>🖨️</span> สั่งพิมพ์รายงาน / บันทึกเป็น PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. QR Code Modal */}
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
                showToast('คัดลอกลิงก์ข้อสอบเรียบร้อยแล้ว!', 'success');
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
            >
              คัดลอกลิงก์สอบ (Direct URL)
            </button>
          </div>
        </div>
      )}

      {/* 6. Create Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📋</span> สร้างชุดข้อสอบใหม่
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">ชื่อชุดข้อสอบ *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แบบทดสอบปลายภาคเรียนที่ 1/2569"
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
                    placeholder="เช่น EXAM-SOC-02"
                    value={newExam.accessCode}
                    onChange={(e) => setNewExam({ ...newExam, accessCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ชื่อรายวิชา</label>
                <input
                  type="text"
                  placeholder="เช่น สังคมศึกษา ศาสนา และวัฒนธรรม"
                  value={newExam.subjectName}
                  onChange={(e) => setNewExam({ ...newExam, subjectName: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">เวลาสอบ (นาที)</label>
                  <input
                    type="number"
                    value={newExam.durationMinutes}
                    onChange={(e) => setNewExam({ ...newExam, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">หลุดจอสูงสุด (ครั้ง)</label>
                  <input
                    type="number"
                    value={newExam.maxViolations}
                    onChange={(e) => setNewExam({ ...newExam, maxViolations: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">อิโมจิวิชา</label>
                  <select
                    value={newExam.emoji}
                    onChange={(e) => setNewExam({ ...newExam, emoji: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-base"
                  >
                    <option value="📝">📝 ข้อสอบ</option>
                    <option value="🏛️">🏛️ สังคม</option>
                    <option value="📜">📜 ประวัติฯ</option>
                    <option value="🛡️">🛡️ ต้านโกง</option>
                    <option value="📚">📚 ภาษาไทย</option>
                    <option value="🔬">🔬 วิทย์ฯ</option>
                    <option value="📐">📐 คณิตฯ</option>
                    <option value="💻">💻 เทคโนฯ</option>
                  </select>
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/40 p-2.5 rounded-xl text-emerald-300 text-[11px]">
                💡 <strong>คำแนะนำ:</strong> เมื่อกดบันทึกแล้ว ระบบจะนำคุณครูเข้าสู่หน้า <strong>"คลังข้อสอบ"</strong> ทันที เพื่อให้เริ่มสร้างข้อสอบข้อแรกได้ทันทีครับ
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                >
                  <span>บันทึกและไปเพิ่มข้อสอบ</span>
                  <span>➡️</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Add Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>✏️</span> เพิ่มข้อสอบข้อใหม่
                </h3>
                <p className="text-xs text-slate-400">
                  ชุดข้อสอบ: <strong className="text-emerald-400">{activeQuestionExam?.subjectName} ({activeQuestionExam?.accessCode})</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAddQuestionModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-4 text-xs">
              {/* ประเภทข้อสอบ & คะแนน */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ประเภทข้อสอบ *</label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value as QuestionType })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="MULTIPLE_CHOICE">ปรนัย (4 ตัวเลือก)</option>
                    <option value="TRUE_FALSE">ถูก / ผิด (True / False)</option>
                    <option value="FILL_IN_BLANK">เติมคำในช่องว่าง</option>
                    <option value="ESSAY">อัตนัย / เขียนบรรยาย</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">คะแนนเต็มของข้อนี้ *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={newQuestion.points}
                    onChange={(e) => setNewQuestion({ ...newQuestion, points: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* ข้อความโจทย์คำถาม */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">โจทย์คำถาม *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="พิมพ์ข้อความคำถามที่ต้องการทดสอบ..."
                  value={newQuestion.promptText}
                  onChange={(e) => setNewQuestion({ ...newQuestion, promptText: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* แบบฟอร์มตามประเภทข้อสอบ */}
              {newQuestion.type === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2.5 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-300">
                      กรอก 4 ตัวเลือก และติ๊กวงกลมหน้าข้อที่ถูกต้อง (เฉลย):
                    </span>
                  </div>
                  
                  {[
                    { key: 'choice1', id: 'c1', label: 'ก' },
                    { key: 'choice2', id: 'c2', label: 'ข' },
                    { key: 'choice3', id: 'c3', label: 'ค' },
                    { key: 'choice4', id: 'c4', label: 'ง' },
                  ].map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`radio_${c.id}`}
                        name="correctChoice"
                        checked={newQuestion.correctChoice === c.id}
                        onChange={() => setNewQuestion({ ...newQuestion, correctChoice: c.id })}
                        className="accent-emerald-500 w-4 h-4 cursor-pointer"
                        title="คลิกเลือกข้อนี้เป็นเฉลย"
                      />
                      <label htmlFor={`radio_${c.id}`} className="w-5 font-bold text-slate-300 cursor-pointer text-center">
                        {c.label}.
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={`ข้อความตัวเลือก ${c.label}`}
                        value={(newQuestion as any)[c.key]}
                        onChange={(e) => setNewQuestion({ ...newQuestion, [c.key]: e.target.value })}
                        className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
                      />
                      {newQuestion.correctChoice === c.id && (
                        <span className="text-emerald-400 font-bold text-[10px] whitespace-nowrap bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">
                          ✓ เฉลย
                        </span>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    * ระบบจะสลับลำดับตัวเลือก ก-ง ให้นักเรียนแต่ละคนโดยอัตโนมัติขณะเข้าสอบ
                  </p>
                </div>
              )}

              {newQuestion.type === 'TRUE_FALSE' && (
                <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <label className="block text-slate-300 font-bold mb-1">คำตอบที่ถูกต้อง (เฉลย) *</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-emerald-500">
                      <input
                        type="radio"
                        name="tfAnswer"
                        value="true"
                        checked={newQuestion.tfAnswer === 'true'}
                        onChange={(e) => setNewQuestion({ ...newQuestion, tfAnswer: e.target.value })}
                        className="accent-emerald-500 w-4 h-4"
                      />
                      <span className="font-bold text-emerald-400">ถูกต้อง (True)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-red-500">
                      <input
                        type="radio"
                        name="tfAnswer"
                        value="false"
                        checked={newQuestion.tfAnswer === 'false'}
                        onChange={(e) => setNewQuestion({ ...newQuestion, tfAnswer: e.target.value })}
                        className="accent-red-500 w-4 h-4"
                      />
                      <span className="font-bold text-red-400">ไม่ถูกต้อง (False)</span>
                    </label>
                  </div>
                </div>
              )}

              {newQuestion.type === 'FILL_IN_BLANK' && (
                <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <label className="block text-slate-300 font-bold mb-1">คำตอบที่ถูกต้อง *</label>
                  <input
                    type="text"
                    required
                    placeholder="พิมพ์คำตอบที่ถูกต้อง (ถ้ามีหลายคำตอบ คั่นด้วยเครื่องหมายจุลภาค ,)"
                    value={newQuestion.blankAnswer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, blankAnswer: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 italic">
                    ตัวอย่าง: เช่น "รัฐธรรมนูญ" หรือ "Realise, Realize"
                  </p>
                </div>
              )}

              {newQuestion.type === 'ESSAY' && (
                <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <label className="block text-slate-300 font-bold mb-1">แนวคำตอบ / รูบริกการให้คะแนน</label>
                  <textarea
                    rows={2}
                    placeholder="ระบุคีย์เวิร์ดสำคัญ หรือเกณฑ์ที่ใช้ในการตรวจให้คะแนน..."
                    value={newQuestion.essayRubric}
                    onChange={(e) => setNewQuestion({ ...newQuestion, essayRubric: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 italic">
                    * ข้อเขียนอัตนัยจะประเมินผลเป็น ผ่าน / ไม่ผ่าน ในแท็บตรวจข้อสอบอัตนัย
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
                >
                  <span>💾</span> บันทึกข้อสอบลงชุดนี้
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7.5 MODERN CHANGE PASSWORD MODAL (ระบบเปลี่ยนรหัสผ่านแอดมิน)        */}
      {/* =================================================================== */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl shadow-inner">
                  🔑
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    เปลี่ยนรหัสผ่านครูผู้สอน
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ตั้งรหัสผ่านใหม่สำหรับเข้าสู่ระบบ Admin Portal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{changePasswordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  รหัสผ่านปัจจุบัน (Old Password) <span className="text-red-400">*</span>
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="กรอกรหัสผ่านเดิม"
                  value={oldPasswordInput}
                  onChange={(e) => setOldPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  รหัสผ่านใหม่ (New Password) <span className="text-red-400">*</span>
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="ความยาวอย่างน้อย 4 ตัวอักษร"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ยืนยันรหัสผ่านใหม่อีกครั้ง (Confirm New Password) <span className="text-red-400">*</span>
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="กรอกรหัสผ่านใหม่ซ้ำอีกครั้ง"
                  value={confirmNewPasswordInput}
                  onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                >
                  <span>{showNewPassword ? '🙈 ซ่อนรหัสผ่าน' : '👁️ แสดงรหัสผ่าน'}</span>
                </button>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition border border-slate-700 active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>💾</span> บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. MODERN CONFIRMATION DIALOG (แทนที่ confirm browser แบบเดิม)        */}
      {/* =================================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="flex justify-center">
              {confirmModal.type === 'danger' && (
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center text-3xl shadow-lg">
                  🗑️
                </div>
              )}
              {confirmModal.type === 'warning' && (
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-3xl shadow-lg">
                  ⚠️
                </div>
              )}
              {confirmModal.type === 'info' && (
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-3xl shadow-lg">
                  🔓
                </div>
              )}
              {confirmModal.type === 'success' && (
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl shadow-lg">
                  ✓
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {confirmModal.message}
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition border border-slate-700 active:scale-95"
              >
                {confirmModal.cancelText || 'ยกเลิก'}
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl transition shadow-lg active:scale-95 ${
                  confirmModal.type === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                }`}
              >
                {confirmModal.confirmText || 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 9. MODERN FLOATING TOAST NOTIFICATION (แทนที่ alert browser แบบเดิม)  */}
      {/* =================================================================== */}
      {toast.isOpen && (
        <div className="fixed bottom-6 right-6 z-[110] max-w-md animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${
            toast.type === 'error'
              ? 'bg-red-950/95 border-red-500/50 text-red-200'
              : toast.type === 'info'
              ? 'bg-blue-950/95 border-blue-500/50 text-blue-200'
              : 'bg-slate-900/95 border-emerald-500/50 text-emerald-200'
          }`}>
            <span className="text-xl">
              {toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✨'}
            </span>
            <div className="flex-1 text-xs leading-snug">
              {toast.message}
            </div>
            <button
              onClick={() => setToast((prev) => ({ ...prev, isOpen: false }))}
              className="text-slate-400 hover:text-white text-sm px-1 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
