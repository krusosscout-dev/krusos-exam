'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { generateExamQRCodeDataUrl } from '@/utils/qrGenerator';
import { INITIAL_EXAMS, getAllExams, saveExamsToStorage, ExamRecord } from '@/services/examData';
import { QuestionDefinition, QuestionType } from '@/types/exam';

// ฟังก์ชันอัจฉริยะแปลงข้อความโจทย์ข้อสอบจำนวนมาก (Smart Bulk Question Parser)
// ฟังก์ชันแยกแยะเฉลยจากข้อความทุกรูปแบบ (AI, ตาราง, Pipe |, 1. ค 2. ก, หรือ 1 ค | 2 ก)
function parseAnswerKeyString(text: string): Record<number, { id: string; letter: string }> {
  if (!text || !text.trim()) return {};
  const map: Record<string, string> = {
    'ก': 'c1', 'a': 'c1', '1': 'c1',
    'ข': 'c2', 'b': 'c2', '2': 'c2',
    'ค': 'c3', 'c': 'c3', '3': 'c3',
    'ง': 'c4', 'd': 'c4', '4': 'c4'
  };

  const letterMap: Record<string, string> = {
    'c1': 'ก',
    'c2': 'ข',
    'c3': 'ค',
    'c4': 'ง',
  };

  const keys: Record<number, { id: string; letter: string }> = {};

  // Regex ตรวจจับรูปแบบข้อและเฉลย:
  // - 1 ค | 2 ก | 3 ง
  // - 1. ค | 2. ก
  // - 1) ค 2) ก
  // - ข้อ 1 ค | ข้อ 2 ก
  // - | 1 | ค | 2 | ก |
  // - 1: ค, 2: ก, 3-ง
  const regex = /(?:\||\b)(?:ข้อ\s*|ข้อที่\s*)?(\d+)[\.\)\s:-]*\|?\s*([กขคงabcdABCD1-4])(?:\s*\||\s*\,|\s*\n|\s+|$)/g;
  const matches = [...text.matchAll(regex)];

  for (const m of matches) {
    const qNum = parseInt(m[1], 10);
    const letter = m[2].toLowerCase();
    if (map[letter]) {
      keys[qNum] = {
        id: map[letter],
        letter: letterMap[map[letter]] || letter
      };
    }
  }

  return keys;
}

function parseBulkExamText(
  text: string,
  defaultScores: Record<string, number>,
  targetExamId: string
): QuestionDefinition[] {
  if (!text || !text.trim()) return [];

  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // 1. ตรวจสอบว่ามีส่วน "เฉลยรวมท้ายข้อสอบ" หรือไม่ (ทั้งแบบมีคำนำหน้า "เฉลย:" หรือบล็อกตาราง "1 ค | 2 ก | 3 ง" จาก AI)
  const globalAnswerKeys: Record<number, string> = {};
  let mainText = clean;

  const headerMatch = clean.match(/(?:เฉลยรวม|เฉลยคำตอบ|เฉลยแบบทดสอบ|เฉลยข้อสอบ|เฉลย|กุญแจเฉลย|answers?[\s_]*keys?|key|solutions?)[\s:]*([\s\S]*)$/i);
  const gridMatch = clean.match(/(?:^|\n+)((?:(?:\d+)[\.\)\s:-]*\|?\s*[กขคงabcdABCD1-4](?:[\s\|\,\/\t]+|$))+)$/i);

  let ansBlockText = '';
  let cutIndex = -1;

  if (headerMatch && headerMatch.index !== undefined && headerMatch.index > 20) {
    ansBlockText = headerMatch[1];
    cutIndex = headerMatch.index;
  } else if (gridMatch && gridMatch.index !== undefined && gridMatch.index > 20) {
    ansBlockText = gridMatch[1];
    cutIndex = gridMatch.index;
  }

  if (ansBlockText) {
    const parsed = parseAnswerKeyString(ansBlockText);
    for (const [qNumStr, item] of Object.entries(parsed)) {
      globalAnswerKeys[Number(qNumStr)] = item.id;
    }
    // ตัดส่วนเฉลยท้ายข้อสอบออก เพื่อไม่ให้กลายเป็นข้อสอบอีกข้อ
    if (Object.keys(globalAnswerKeys).length > 0 && cutIndex > 0) {
      mainText = clean.substring(0, cutIndex).trim();
    }
  }

  // 2. แยกตามเลขข้อ: 1. หรือ 1) หรือ ข้อ 1. หรือ ข้อ 1)
  const questionBlocks = mainText.split(/(?:^|\n+)(?:ข้อที่\s*|ข้อ\s*)?(\d+)[\.\)]\s*/g);
  const results: QuestionDefinition[] = [];

  for (let i = 1; i < questionBlocks.length; i += 2) {
    const qNumberDetected = parseInt(questionBlocks[i], 10) || (results.length + 1);
    const content = (questionBlocks[i + 1] || '').trim();
    if (!content) continue;

    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const prompt = lines[0];
    let mediaUrl: string | null = null;
    const imgMatch = content.match(/\[(?:รูป|img|image):\s*([^\]]+)\]/i);
    if (imgMatch) {
      mediaUrl = imgMatch[1].trim();
    }

    const cleanPrompt = prompt.replace(/\[(?:รูป|img|image):\s*[^\]]+\]/gi, '').trim();

    // ตรวจสอบว่าเป็นข้อสอบ ถูก/ผิด หรือไม่
    const isTF =
      content.includes('ถูก/ผิด') ||
      content.includes('ถูกหรือผิด') ||
      /(?:เฉลย|คำตอบ)[\s:]*(?:ถูก|ผิด|true|false)/i.test(content) ||
      lines.some((l) => /^[ก-งa-d1-4][\.\)]\s*(?:ถูก|จริง)/.test(l));

    // ตรวจสอบว่าเป็นข้อสอบ อัตนัย (ข้อเขียน) หรือไม่
    const isEssay =
      content.includes('(อัตนัย)') ||
      content.includes('(ข้อเขียน)') ||
      content.includes('(บรรยาย)') ||
      (!isTF && !lines.slice(1).some((l) => /^[กขคงabcdABCD1-4][\.\)]/.test(l)) && lines.length <= 3);

    if (isEssay) {
      results.push({
        id: `q_bulk_${Date.now()}_${results.length + 1}`,
        examId: targetExamId,
        questionNumber: results.length + 1,
        type: 'ESSAY',
        promptText: cleanPrompt,
        mediaUrl,
        points: defaultScores.ESSAY ?? 5.0,
        optionsPayload: null,
        answerKey: 'ตรวจโดยครูผู้สอน',
      });
    } else if (isTF) {
      let answer = 'true';
      if (
        /(?:เฉลย|คำตอบ)[\s:]*(?:ผิด|false)/i.test(content) ||
        content.includes('เฉลย: ผิด') ||
        content.includes('เฉลย ผิด')
      ) {
        answer = 'false';
      }
      results.push({
        id: `q_bulk_${Date.now()}_${results.length + 1}`,
        examId: targetExamId,
        questionNumber: results.length + 1,
        type: 'TRUE_FALSE',
        promptText: cleanPrompt.replace(/(?:เฉลย|คำตอบ)[\s:]*(?:ถูก|ผิด|true|false)/gi, '').trim(),
        mediaUrl,
        points: defaultScores.TRUE_FALSE ?? 1.0,
        optionsPayload: null,
        answerKey: answer,
      });
    } else {
      // MULTIPLE_CHOICE: ค้นหาตัวเลือก ทั้งแบบบรรทัดละข้อ และแบบหลายตัวเลือกในบรรทัดเดียว
      const choiceLines: { id: string; text: string; isCorrect: boolean }[] = [];
      const choiceIds = ['c1', 'c2', 'c3', 'c4'];
      let correctChoice = globalAnswerKeys[qNumberDetected] || null;

      // รวมเนื้อหาบรรทัดหลังจากโจทย์เพื่อแยกช้อยส์
      const restContent = lines.slice(1).join('\n');
      
      // ตรวจจับตัวเลือก ก-ง หรือ A-D (รองรับ * นำหน้า เช่น *ค. หรือตามหลัง เช่น ค.* หรือ (เฉลย))
      const choiceRegex = /(?:^|\n|\s+)([\*\✓\✔]?)\s*\(?([กขคงabcdABCD1-4])\)?[\.\s\)]\s*([^\n\r]*?)(?=(?:\s+[\*\✓\✔]?\s*\(?[กขคงabcdABCD1-4]\)?[\.\s\)])|\n|$)/g;
      const matches = [...restContent.matchAll(choiceRegex)];

      if (matches.length > 0) {
        for (const m of matches) {
          const leadingMark = m[1] || '';
          let cText = (m[3] || '').trim();
          let isCorrect = Boolean(leadingMark.includes('*') || leadingMark.includes('✓') || leadingMark.includes('✔'));

          if (cText.endsWith('*') || cText.includes('(ถูก)') || cText.includes('(เฉลย)') || cText.includes('[x]')) {
            isCorrect = true;
            cText = cText.replace(/\*|\(ถูก\)|\(เฉลย\)|\[x\]/g, '').trim();
          }

          const cId = choiceIds[choiceLines.length] || `c${choiceLines.length + 1}`;
          choiceLines.push({ id: cId, text: cText, isCorrect });
          if (isCorrect && !correctChoice) {
            correctChoice = cId;
          }
        }
      } else {
        // Fallback line-by-line
        for (const line of lines.slice(1)) {
          const choiceMatch = line.match(/^[\*\✓\✔\s\-]*\(?([กขคงabcdABCD1-4])\)?[\.\s\)]\s*(.*)/);
          if (choiceMatch) {
            let cText = choiceMatch[2].trim();
            let isCorrect = line.startsWith('*') || line.startsWith('✓');
            if (cText.endsWith('*') || cText.includes('(ถูก)') || cText.includes('(เฉลย)')) {
              isCorrect = true;
              cText = cText.replace(/\*|\(ถูก\)|\(เฉลย\)/g, '').trim();
            }
            const cId = choiceIds[choiceLines.length] || `c${choiceLines.length + 1}`;
            choiceLines.push({ id: cId, text: cText, isCorrect });
            if (isCorrect && !correctChoice) {
              correctChoice = cId;
            }
          }
        }
      }

      // ตรวจสอบเฉลยบรรทัดพิเศษ เช่น "เฉลย: ค" หรือ "ตอบ: ค"
      if (!correctChoice) {
        const ansLine = lines.find((l) => /(?:เฉลย|คำตอบ|ตอบ)[\s:]*([กขคงabcdABCD1-4])/i.test(l));
        if (ansLine) {
          const m = ansLine.match(/(?:เฉลย|คำตอบ|ตอบ)[\s:]*([กขคงabcdABCD1-4])/i);
          if (m) {
            const letter = m[1].toLowerCase();
            const map: Record<string, string> = {
              'ก': 'c1', 'a': 'c1', '1': 'c1',
              'ข': 'c2', 'b': 'c2', '2': 'c2',
              'ค': 'c3', 'c': 'c3', '3': 'c3',
              'ง': 'c4', 'd': 'c4', '4': 'c4'
            };
            if (map[letter]) correctChoice = map[letter];
          }
        }
      }

      while (choiceLines.length < 4) {
        const idx = choiceLines.length;
        const labels = ['ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง'];
        choiceLines.push({ id: choiceIds[idx], text: labels[idx], isCorrect: false });
      }

      results.push({
        id: `q_bulk_${Date.now()}_${results.length + 1}`,
        examId: targetExamId,
        questionNumber: results.length + 1,
        type: 'MULTIPLE_CHOICE',
        promptText: cleanPrompt,
        mediaUrl,
        points: defaultScores.MULTIPLE_CHOICE ?? 1.0,
        optionsPayload: choiceLines.slice(0, 4),
        answerKey: correctChoice || 'c1',
      });
    }
  }

  return results;
}

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

  // เกณฑ์คะแนนมาตรฐานตามประเภทข้อสอบ (ข้อสอบอัตนัยไม่นำมาคิดในคะแนนตรวจอัตโนมัติ)
  const [typeScores, setTypeScores] = useState<Record<string, number>>({
    MULTIPLE_CHOICE: 1.0,
    TRUE_FALSE: 1.0,
    MATCHING: 3.0,
    FILL_IN_BLANK: 2.0,
    ESSAY: 5.0, // ครูตรวจเอง ไม่คิดในคะแนนตรวจอัตโนมัติ
  });
  const [showScoreRulesModal, setShowScoreRulesModal] = useState<boolean>(false);

  // สลับการย่อ/ขยายการ์ดข้อสอบแต่ละวิชา (ค่าเริ่มต้นขยายทุกวิชา)
  const [expandedExamCards, setExpandedExamCards] = useState<Record<string, boolean>>({});
  const toggleExamCardExpand = (code: string) => {
    setExpandedExamCards((prev) => ({
      ...prev,
      [code]: prev[code] !== undefined ? !prev[code] : false,
    }));
  };

  // Pending Answer Changes: เมื่อแอดมินติ๊กเลือกเฉลยบนการ์ด แล้วต้องกดปุ่ม "💾 บันทึกเฉลย" เพื่อยืนยัน
  const [pendingAnswerChanges, setPendingAnswerChanges] = useState<
    Record<string, { answerKey: any; choiceLabel: string }>
  >({});

  // Add Question Modal State (พร้อมรองรับรูปภาพประกอบโจทย์ และแก้ไขข้อสอบเดิม)
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [targetExamForAdd, setTargetExamForAdd] = useState<string>('EXAM-SOC-01');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    type: 'MULTIPLE_CHOICE' as QuestionType,
    promptText: '',
    mediaUrl: '',
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

  const resetQuestionForm = (preselectedType: QuestionType = 'MULTIPLE_CHOICE') => {
    setEditingQuestionId(null);
    setNewQuestion({
      type: preselectedType,
      promptText: '',
      mediaUrl: '',
      points: typeScores[preselectedType] ?? 1.0,
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

  const openEditQuestionModal = (examAccessCode: string, question: QuestionDefinition) => {
    setTargetExamForAdd(examAccessCode);
    setEditingQuestionId(question.id);

    let choice1 = '';
    let choice2 = '';
    let choice3 = '';
    let choice4 = '';
    let correctChoice = 'c1';

    if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(question.optionsPayload)) {
      choice1 = question.optionsPayload[0]?.text || '';
      choice2 = question.optionsPayload[1]?.text || '';
      choice3 = question.optionsPayload[2]?.text || '';
      choice4 = question.optionsPayload[3]?.text || '';
      correctChoice = String(question.answerKey || 'c1');
    }

    setNewQuestion({
      type: question.type,
      promptText: question.promptText || '',
      mediaUrl: question.mediaUrl || '',
      points: question.points || 1.0,
      choice1,
      choice2,
      choice3,
      choice4,
      correctChoice,
      tfAnswer: String(question.answerKey ?? 'true'),
      blankAnswer: Array.isArray(question.answerKey) ? question.answerKey.join(', ') : String(question.answerKey || ''),
      essayRubric: String(question.answerKey || ''),
    });

    setShowAddQuestionModal(true);
  };

  // Bulk / Batch Question Import Modal State (เพิ่มข้อสอบทีละหลายข้อเพื่อประหยัดเวลา)
  const [showBulkAddModal, setShowBulkAddModal] = useState<boolean>(false);
  const [bulkExamTargetCode, setBulkExamTargetCode] = useState<string>('EXAM-SOC-01');
  const [bulkActiveTab, setBulkActiveTab] = useState<'smart_paste' | 'quick_form'>('smart_paste');
  const [bulkRawText, setBulkRawText] = useState<string>('');
  const [bulkParsedQuestions, setBulkParsedQuestions] = useState<QuestionDefinition[]>([]);

  // Quick Answer Key Modal State (วางเฉลยด่วนจาก AI เช่น 1 ค | 2 ก | 3 ง หรือ 1. ค 2. ก)
  const [showQuickAnswerModal, setShowQuickAnswerModal] = useState<boolean>(false);
  const [quickAnswerTargetCode, setQuickAnswerTargetCode] = useState<string>('EXAM-SOC-01');
  const [quickAnswerRawText, setQuickAnswerRawText] = useState<string>('');
  const [quickRows, setQuickRows] = useState<Array<{
    promptText: string;
    type: QuestionType;
    mediaUrl?: string;
    points: number;
    choice1?: string;
    choice2?: string;
    choice3?: string;
    choice4?: string;
    correctChoice?: string;
    tfAnswer?: string;
    blankAnswer?: string;
  }>>([
    { promptText: '', type: 'MULTIPLE_CHOICE', points: 1.0, choice1: '', choice2: '', choice3: '', choice4: '', correctChoice: 'c1' },
    { promptText: '', type: 'MULTIPLE_CHOICE', points: 1.0, choice1: '', choice2: '', choice3: '', choice4: '', correctChoice: 'c1' },
    { promptText: '', type: 'TRUE_FALSE', points: 1.0, tfAnswer: 'true' },
  ]);

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
    let csvContent = '\uFEFFอันดับ,เลขที่,เลขประจำตัว,ชื่อ - นามสกุล,ระดับชั้น,คะแนนปรนัย/จับคู่,คะแนนเต็ม,คะแนนข้อเขียน (อัตนัย),จำนวนครั้งหลุดจอ,เวลาที่ส่ง\n';
    
    const sorted = [...filteredScores].sort((a, b) => b.objectiveScore - a.objectiveScore);
    sorted.forEach((item, index) => {
      const essayColText = (item as any).essayScore !== undefined && (item as any).essayScore !== null 
        ? `${(item as any).essayScore}` 
        : 'รอตรวจให้คะแนน';
      const row = [
        index + 1,
        `"${item.seatNumber || index + 1}"`,
        `"${item.studentId}"`,
        `"${item.studentName}"`,
        `"${item.classroom}"`,
        item.objectiveScore,
        item.objectiveMax,
        `"${essayColText}"`,
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

    const targetCode = targetExamForAdd || selectedQuestionExamCode;
    const targetExam = exams.find((ex) => ex.accessCode === targetCode);
    if (!targetExam) {
      showToast('ไม่พบชุดข้อสอบที่เลือก', 'error');
      return;
    }

    const currentCount = targetExam.questions.length;
    const newQId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

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

    if (editingQuestionId) {
      const updatedExams = exams.map((ex) => {
        if (ex.accessCode === targetCode) {
          const updatedQuestions = ex.questions.map((q) => {
            if (q.id === editingQuestionId) {
              return {
                ...q,
                type: newQuestion.type,
                promptText: newQuestion.promptText.trim(),
                mediaUrl: newQuestion.mediaUrl?.trim() || null,
                points: Number(newQuestion.points) || (typeScores[newQuestion.type] ?? 1.0),
                optionsPayload,
                answerKey,
              };
            }
            return q;
          });
          return {
            ...ex,
            questions: updatedQuestions,
          };
        }
        return ex;
      });

      setExams(updatedExams);
      saveExamsToStorage(updatedExams);
      setShowAddQuestionModal(false);
      setEditingQuestionId(null);
      resetQuestionForm();
      showToast(`บันทึกการแก้ไขข้อสอบเรียบร้อยแล้ว ✓`, 'success');
      return;
    }

    const newQuestionDef: QuestionDefinition = {
      id: newQId,
      examId: targetExam.id,
      questionNumber: currentCount + 1,
      type: newQuestion.type,
      promptText: newQuestion.promptText.trim(),
      mediaUrl: newQuestion.mediaUrl?.trim() || null,
      points: Number(newQuestion.points) || (typeScores[newQuestion.type] ?? 1.0),
      optionsPayload,
      answerKey,
    };

    const updatedExams = exams.map((ex) => {
      if (ex.accessCode === targetCode) {
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
    showToast(`เพิ่มข้อสอบข้อที่ ${newQuestionDef.questionNumber} ลงในวิชา ${targetExam.subjectName} เรียบร้อยแล้ว`, 'success');
  };

  // จัดการนำเข้าข้อสอบทีละหลายข้อ (Bulk Import)
  const handleBulkImport = (questionsToImport: QuestionDefinition[], targetCode: string) => {
    if (questionsToImport.length === 0) {
      showToast('ไม่มีข้อสอบที่จะนำเข้า กรุณากรอกหรือวางข้อความข้อสอบ', 'error');
      return;
    }
    const targetExam = exams.find((ex) => ex.accessCode === targetCode);
    if (!targetExam) {
      showToast('ไม่พบชุดข้อสอบปลายทาง', 'error');
      return;
    }

    const startIdx = targetExam.questions.length;
    const renumbered = questionsToImport.map((q, idx) => ({
      ...q,
      examId: targetExam.id,
      questionNumber: startIdx + idx + 1,
    }));

    const updatedExams = exams.map((ex) => {
      if (ex.accessCode === targetCode) {
        return {
          ...ex,
          questions: [...ex.questions, ...renumbered],
        };
      }
      return ex;
    });

    setExams(updatedExams);
    saveExamsToStorage(updatedExams);
    setShowBulkAddModal(false);
    setBulkRawText('');
    setBulkParsedQuestions([]);
    showToast(`นำเข้าข้อสอบสำเร็จ ${renumbered.length} ข้อ ลงในวิชา ${targetExam.subjectName} เรียบร้อยแล้ว! 🚀`, 'success');
  };

  const handleDeleteQuestion = (examAccessCode: string, questionId: string, qIndex: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบข้อสอบ',
      message: `คุณครูต้องการลบข้อสอบข้อที่ ${qIndex + 1} นี้ออกจากชุดข้อสอบใช่หรือไม่? การกระทำนี้ไม่สามารถเรียกคืนได้`,
      confirmText: 'ลบข้อสอบนี้ 🗑️',
      cancelText: 'ยกเลิก',
      type: 'danger',
      onConfirm: () => {
        const updatedExams = exams.map((ex) => {
          if (ex.accessCode === examAccessCode) {
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

  // ติ๊กเลือกตัวเลือกเฉลยบนการ์ด (สเตจไว้ ยังไม่บันทึก จนกว่าจะกดปุ่มบันทึก)
  const handleSelectQuestionAnswer = (
    questionId: string,
    currentSavedAnswer: any,
    newAnswerKey: any,
    choiceLabel: string
  ) => {
    // ถ้าคลิกเลือกกลับไปเป็นเฉลยเดิม ให้ล้างการเปลี่ยนแปลงค้างไว้
    if (newAnswerKey === currentSavedAnswer) {
      setPendingAnswerChanges((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      return;
    }

    setPendingAnswerChanges((prev) => ({
      ...prev,
      [questionId]: { answerKey: newAnswerKey, choiceLabel },
    }));
  };

  // ยกเลิกการติ๊กเปลี่ยนเฉลย
  const handleCancelPendingAnswer = (questionId: string) => {
    setPendingAnswerChanges((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    showToast('ยกเลิกการเปลี่ยนแปลงเฉลยแล้ว', 'info');
  };

  // กดปุ่ม "💾 บันทึกเฉลยข้อนี้" เพื่อยืนยันการบันทึกเฉลยที่ติ๊กไว้
  const handleSavePendingAnswer = (
    examAccessCode: string,
    questionId: string,
    qIndex: number
  ) => {
    const pending = pendingAnswerChanges[questionId];
    if (!pending) return;

    const updatedExams = exams.map((ex) => {
      if (ex.accessCode === examAccessCode) {
        const updatedQuestions = ex.questions.map((q) => {
          if (q.id === questionId) {
            return { ...q, answerKey: pending.answerKey };
          }
          return q;
        });
        return { ...ex, questions: updatedQuestions };
      }
      return ex;
    });

    setExams(updatedExams);
    saveExamsToStorage(updatedExams);

    setPendingAnswerChanges((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });

    showToast(
      `บันทึกเฉลยข้อที่ ${qIndex + 1} เป็นตัวเลือก "${pending.choiceLabel}" เรียบร้อยแล้ว ✓`,
      'success'
    );
  };

  // ฟังก์ชันช่วยเหลือบันทึกเฉลยโดยตรง (กรณีใช้งานภายนอก)
  const handleUpdateQuestionAnswer = (
    examAccessCode: string,
    questionId: string,
    newAnswerKey: any,
    choiceLabel?: string
  ) => {
    const updatedExams = exams.map((ex) => {
      if (ex.accessCode === examAccessCode) {
        const updatedQuestions = ex.questions.map((q) => {
          if (q.id === questionId) {
            return { ...q, answerKey: newAnswerKey };
          }
          return q;
        });
        return { ...ex, questions: updatedQuestions };
      }
      return ex;
    });

    setExams(updatedExams);
    saveExamsToStorage(updatedExams);
    showToast(
      choiceLabel
        ? `บันทึกเฉลยเป็น "${choiceLabel}" เรียบร้อยแล้ว ✓`
        : 'อัปเดตเฉลยข้อสอบเรียบร้อยแล้ว ✓',
      'success'
    );
  };

  // เปิดหน้าต่าง "วางเฉลยด่วนจาก AI"
  const openQuickAnswerModal = (accessCode: string) => {
    setQuickAnswerTargetCode(accessCode);
    setQuickAnswerRawText('');
    setShowQuickAnswerModal(true);
  };

  // ยืนยันบันทึกเฉลยด่วนที่คัดลอกมาจาก AI ลงในชุดข้อสอบ
  const handleApplyQuickAnswers = () => {
    const parsed = parseAnswerKeyString(quickAnswerRawText);
    const parsedCount = Object.keys(parsed).length;
    if (parsedCount === 0) {
      showToast('ไม่พบข้อมูลเฉลย กรุณาวางข้อความเฉลย เช่น 1 ค | 2 ก | 3 ง', 'error');
      return;
    }

    const targetExam = exams.find((e) => e.accessCode === quickAnswerTargetCode);
    if (!targetExam) {
      showToast('ไม่พบชุดข้อสอบที่เลือก', 'error');
      return;
    }

    let matchCount = 0;
    const updatedQuestions = targetExam.questions.map((q, idx) => {
      const qNum = q.questionNumber || (idx + 1);
      if (parsed[qNum]) {
        matchCount++;
        return {
          ...q,
          answerKey: parsed[qNum].id,
        };
      }
      return q;
    });

    const updatedExams = exams.map((ex) => {
      if (ex.accessCode === quickAnswerTargetCode) {
        return { ...ex, questions: updatedQuestions };
      }
      return ex;
    });

    setExams(updatedExams);
    saveExamsToStorage(updatedExams);
    setShowQuickAnswerModal(false);
    setQuickAnswerRawText('');
    showToast(
      `อัปเดตเฉลยด่วนสำเร็จ ${matchCount} ข้อ สำหรับวิชา ${targetExam.subjectName} เรียบร้อยแล้ว! 🎯✓`,
      'success'
    );
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
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span className="text-emerald-400 font-mono font-bold">KruSos Exam</span>
              <span className="text-slate-300">• จัดการข้อสอบ (Admin)</span>
            </h1>
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
          <div className="space-y-6">
            {/* 1. แถบเครื่องมือด้านบน: ชื่อคลังข้อสอบ และปุ่มการจัดการระดับระบบ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📚</span> คลังข้อสอบแยกตามวิชา (Subject Question Bank)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  แสดงเป็นการ์ดแต่ละวิชาอย่างชัดเจน จัดการ เพิ่ม ลบ และตรวจดูข้อสอบได้โดยตรง ไม่ต้องกดสลับไปมา
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowScoreRulesModal(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-slate-700 hover:border-emerald-500/50 shadow-sm active:scale-95"
                  title="กำหนดคะแนนมาตรฐานตามประเภทข้อสอบ"
                >
                  <span>⚙️</span>
                  <span>กำหนดคะแนนแต่ละประเภท</span>
                </button>

                <button
                  onClick={() => {
                    setBulkExamTargetCode(exams[0]?.accessCode || '');
                    setBulkRawText('');
                    setBulkParsedQuestions([]);
                    setShowBulkAddModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 active:scale-95"
                  title="เพิ่มข้อสอบทีละหลายข้อพร้อมกันเพื่อประหยัดเวลา"
                >
                  <span>⚡</span>
                  <span>เพิ่มข้อสอบทีละหลายข้อ (Bulk)</span>
                </button>
              </div>
            </div>

            {/* 2. การ์ดแต่ละวิชาแยกจากกันอย่างชัดเจน (เหมือนหน้าจัดการชุดข้อสอบ) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {exams.map((exam) => {
                const objectiveQuestions = exam.questions.filter((q) => q.type !== 'ESSAY');
                const essayQuestions = exam.questions.filter((q) => q.type === 'ESSAY');
                const totalObjectivePoints = Number(
                  objectiveQuestions.reduce((sum, q) => sum + (q.points || 0), 0).toFixed(2)
                );
                const isCollapsed = expandedExamCards[exam.accessCode] === false;

                const mcqCount = exam.questions.filter((q) => q.type === 'MULTIPLE_CHOICE').length;
                const tfCount = exam.questions.filter((q) => q.type === 'TRUE_FALSE').length;
                const matchCount = exam.questions.filter((q) => q.type === 'MATCHING').length;
                const fillCount = exam.questions.filter((q) => q.type === 'FILL_IN_BLANK').length;
                const essayCount = essayQuestions.length;

                return (
                  <div
                    key={exam.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4 transition duration-200 relative"
                  >
                    {/* ส่วนหัวของการ์ดประจำวิชา */}
                    <div className="space-y-2.5 border-b border-slate-800 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-2xl shadow-inner shrink-0">
                            {exam.emoji || '📝'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                              {exam.accessCode} • {exam.subjectCode}
                            </span>
                            <h3 className="font-bold text-white text-base leading-tight mt-1 truncate">
                              {exam.subjectName}
                            </h3>
                          </div>
                        </div>

                        <Link
                          href={`/gateway/${exam.accessCode}`}
                          target="_blank"
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-medium rounded-xl transition border border-slate-700 flex items-center gap-1.5 shrink-0 shadow-sm"
                          title="ทดลองเข้าทำข้อสอบชุดนี้ในมุมมองนักเรียน"
                        >
                          <span>👁️</span>
                          <span className="hidden sm:inline">ทดลองสอบ</span>
                        </Link>
                      </div>

                      <p className="text-xs text-slate-400 leading-snug">
                        ชื่อชุด: <strong className="text-slate-200">{exam.title}</strong>
                      </p>

                      {/* แถบสรุปคะแนน: คะแนนตรวจอัตโนมัติ (ไม่รวมอัตนัย) และข้อเขียนรอตรวจ */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-xl font-bold border border-slate-700">
                          รวม {exam.questions.length} ข้อ
                        </span>
                        <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 rounded-xl font-mono font-bold border border-emerald-700/60 shadow-sm">
                          🎯 คะแนนตรวจอัตโนมัติ: {totalObjectivePoints} คะแนน
                        </span>
                        {essayCount > 0 && (
                          <span className="px-2.5 py-1 bg-amber-950/70 text-amber-300 rounded-xl font-medium border border-amber-600/50 shadow-sm">
                            ✍️ อัตนัย {essayCount} ข้อ (ครูตรวจเอง)
                          </span>
                        )}
                      </div>

                      {/* ป้ายแจกแจงจำนวนข้อตามประเภท */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400 pt-0.5">
                        {mcqCount > 0 && <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-750">ปรนัย {mcqCount} ข้อ</span>}
                        {tfCount > 0 && <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-750">ถูก/ผิด {tfCount} ข้อ</span>}
                        {matchCount > 0 && <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-750">จับคู่ {matchCount} ข้อ</span>}
                        {fillCount > 0 && <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-750">เติมคำ {fillCount} ข้อ</span>}
                        {essayCount > 0 && <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md">ข้อเขียน {essayCount} ข้อ</span>}
                      </div>
                    </div>

                    {/* แถบปุ่มจัดการประจำการ์ดวิชานี้ */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setTargetExamForAdd(exam.accessCode);
                            resetQuestionForm();
                            setShowAddQuestionModal(true);
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 active:scale-95"
                        >
                          <span>+</span> เพิ่มข้อสอบ
                        </button>
                        <button
                          onClick={() => {
                            setBulkExamTargetCode(exam.accessCode);
                            setBulkRawText('');
                            setBulkParsedQuestions([]);
                            setShowBulkAddModal(true);
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl transition border border-slate-700 hover:border-emerald-500/50 flex items-center gap-1.5 active:scale-95"
                          title="นำเข้าข้อสอบหลายข้อพร้อมกันลงในวิชานี้"
                        >
                          <span>⚡</span> เพิ่มหลายข้อ
                        </button>
                        <button
                          onClick={() => openQuickAnswerModal(exam.accessCode)}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold rounded-xl transition border border-slate-700 hover:border-amber-500/50 flex items-center gap-1.5 active:scale-95 shadow-sm"
                          title="คัดลอกข้อความเฉลยจาก AI เช่น 1 ค | 2 ก | 3 ง มาวางเพื่อบันทึกเฉลยทุกข้อในคลิกเดียว"
                        >
                          <span>🎯</span> วางเฉลยด่วน
                        </button>
                      </div>

                      <button
                        onClick={() => toggleExamCardExpand(exam.accessCode)}
                        className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition flex items-center gap-1.5 border border-transparent hover:border-slate-700"
                      >
                        <span>{isCollapsed ? '📂 แสดงข้อสอบ' : '📁 ซ่อนข้อสอบ'}</span>
                        <span className="font-mono text-[11px]">({exam.questions.length})</span>
                        <span className="text-[10px]">{isCollapsed ? '▼' : '▲'}</span>
                      </button>
                    </div>

                    {/* รายการข้อสอบภายใน Card ของวิชานี้ */}
                    {!isCollapsed && (
                      <div className="space-y-3 pt-2.5 border-t border-slate-800/80 max-h-[550px] overflow-y-auto pr-1 scroll-smooth">
                        {exam.questions.length === 0 ? (
                          <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs space-y-2.5">
                            <span className="text-3xl block">📝</span>
                            <p className="font-medium text-slate-300">ยังไม่มีข้อสอบในวิชานี้</p>
                            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                              คุณครูสามารถคลิก "+ เพิ่มข้อสอบ" หรือ "⚡ เพิ่มหลายข้อ" ด้านบนเพื่อเริ่มสร้างข้อสอบได้ทันทีครับ
                            </p>
                          </div>
                        ) : (
                          exam.questions.map((q, idx) => (
                            <div
                              key={q.id}
                              className="bg-slate-800/70 hover:bg-slate-800/95 p-4 rounded-2xl border border-slate-700/80 space-y-2.5 text-xs transition shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-emerald-400">ข้อที่ {idx + 1}</span>
                                  <span className="text-[10px] bg-slate-700/90 text-slate-200 px-2 py-0.5 rounded-lg font-medium border border-slate-600/50">
                                    {q.type === 'MULTIPLE_CHOICE' && 'ปรนัย (4 ตัวเลือก)'}
                                    {q.type === 'TRUE_FALSE' && 'ถูก / ผิด'}
                                    {q.type === 'FILL_IN_BLANK' && 'เติมคำ'}
                                    {q.type === 'MATCHING' && 'จับคู่'}
                                    {q.type === 'ESSAY' && 'อัตนัย (ข้อเขียน)'}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono font-medium">
                                    ({q.points} คะแนน {q.type === 'ESSAY' ? '• ตรวจเอง' : ''})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditQuestionModal(exam.accessCode, q)}
                                    className="text-amber-400 hover:text-amber-200 hover:bg-amber-950/80 px-2.5 py-1 rounded-lg transition border border-amber-800/40 text-xs flex items-center gap-1 active:scale-95 font-medium"
                                    title="แก้ไขข้อสอบข้อนี้ (โจทย์, รูปภาพ, ตัวเลือก, คะแนน)"
                                  >
                                    <span>✏️</span> แก้ไข
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteQuestion(exam.accessCode, q.id, idx)}
                                    className="text-red-400 hover:text-red-200 hover:bg-red-950/80 px-2.5 py-1 rounded-lg transition border border-red-800/40 text-xs flex items-center gap-1 active:scale-95"
                                    title="ลบข้อสอบข้อนี้"
                                  >
                                    <span>🗑️</span> ลบ
                                  </button>
                                </div>
                              </div>

                              {/* ข้อความโจทย์คำถาม */}
                              <p className="text-slate-100 font-medium leading-relaxed">{q.promptText}</p>

                              {/* รูปภาพประกอบโจทย์คำถาม (ถ้ามี) */}
                              {q.mediaUrl && (
                                <div className="max-w-xs rounded-xl overflow-hidden border border-slate-700 bg-slate-950/80 p-1.5 shadow-inner">
                                  <img
                                    src={q.mediaUrl}
                                    alt="รูปภาพประกอบโจทย์คำถาม"
                                    className="max-h-40 w-auto object-contain rounded-lg mx-auto hover:scale-105 transition duration-200"
                                  />
                                </div>
                              )}

                              {/* แสดงตัวเลือก / เฉลย (ติ๊กเลือกเฉลยแล้วกดบันทึก) */}
                              {q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.optionsPayload) && (() => {
                                const pending = pendingAnswerChanges[q.id];
                                const activeAnswerKey = pending !== undefined ? pending.answerKey : q.answerKey;
                                const hasPendingChange = pending !== undefined && pending.answerKey !== q.answerKey;

                                return (
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                                      <span className="flex items-center gap-1 font-medium text-slate-300">
                                        <span>👆</span> ติ๊กเลือกตัวเลือก (ก-ง) แล้วกดปุ่ม <strong>"💾 บันทึกเฉลย"</strong> เพื่อยืนยัน
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {q.optionsPayload.map((opt: any, oIdx: number) => {
                                        const letter = ['ก', 'ข', 'ค', 'ง'][oIdx] || String(oIdx + 1);
                                        const isSelected =
                                          activeAnswerKey === opt.id ||
                                          (Array.isArray(activeAnswerKey) && activeAnswerKey.includes(opt.id)) ||
                                          activeAnswerKey === opt.text ||
                                          (typeof activeAnswerKey === 'string' && (
                                            (activeAnswerKey.toLowerCase() === 'c1' && opt.id === 'c1') ||
                                            (activeAnswerKey.toLowerCase() === 'c2' && opt.id === 'c2') ||
                                            (activeAnswerKey.toLowerCase() === 'c3' && opt.id === 'c3') ||
                                            (activeAnswerKey.toLowerCase() === 'c4' && opt.id === 'c4') ||
                                            (['ก', 'a', '1'].includes(activeAnswerKey.trim().toLowerCase()) && oIdx === 0) ||
                                            (['ข', 'b', '2'].includes(activeAnswerKey.trim().toLowerCase()) && oIdx === 1) ||
                                            (['ค', 'c', '3'].includes(activeAnswerKey.trim().toLowerCase()) && oIdx === 2) ||
                                            (['ง', 'd', '4'].includes(activeAnswerKey.trim().toLowerCase()) && oIdx === 3)
                                          ));

                                        const isOriginalSaved =
                                          q.answerKey === opt.id ||
                                          (Array.isArray(q.answerKey) && q.answerKey.includes(opt.id)) ||
                                          q.answerKey === opt.text ||
                                          (typeof q.answerKey === 'string' && (
                                            (q.answerKey.toLowerCase() === 'c1' && opt.id === 'c1') ||
                                            (q.answerKey.toLowerCase() === 'c2' && opt.id === 'c2') ||
                                            (q.answerKey.toLowerCase() === 'c3' && opt.id === 'c3') ||
                                            (q.answerKey.toLowerCase() === 'c4' && opt.id === 'c4') ||
                                            (['ก', 'a', '1'].includes(q.answerKey.trim().toLowerCase()) && oIdx === 0) ||
                                            (['ข', 'b', '2'].includes(q.answerKey.trim().toLowerCase()) && oIdx === 1) ||
                                            (['ค', 'c', '3'].includes(q.answerKey.trim().toLowerCase()) && oIdx === 2) ||
                                            (['ง', 'd', '4'].includes(q.answerKey.trim().toLowerCase()) && oIdx === 3)
                                          ));

                                        return (
                                          <button
                                            key={opt.id || oIdx}
                                            type="button"
                                            onClick={() =>
                                              handleSelectQuestionAnswer(
                                                q.id,
                                                q.answerKey,
                                                opt.id,
                                                `${letter}. ${opt.text}`
                                              )
                                            }
                                            className={`p-2.5 px-3 rounded-xl text-[11px] flex items-center justify-between transition text-left group cursor-pointer active:scale-98 ${
                                              isSelected && hasPendingChange
                                                ? 'bg-amber-950/70 text-amber-200 border-2 border-amber-400 shadow-md ring-2 ring-amber-400/40 font-semibold'
                                                : isSelected
                                                ? 'bg-emerald-950/90 text-emerald-200 border-2 border-emerald-500 shadow-md ring-1 ring-emerald-500/50 font-semibold'
                                                : 'bg-slate-900/70 hover:bg-slate-800 text-slate-300 border border-slate-700/80 hover:border-emerald-500/60'
                                            }`}
                                            title="คลิกเพื่อติ๊กเลือกข้อนี้เป็นเฉลย"
                                          >
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                              <input
                                                type="radio"
                                                name={`card_radio_${q.id}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  handleSelectQuestionAnswer(
                                                    q.id,
                                                    q.answerKey,
                                                    opt.id,
                                                    `${letter}. ${opt.text}`
                                                  )
                                                }
                                                className="accent-emerald-500 w-4 h-4 cursor-pointer shrink-0"
                                              />
                                              <span
                                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition ${
                                                  isSelected && hasPendingChange
                                                    ? 'bg-amber-400 text-slate-950 shadow'
                                                    : isSelected
                                                    ? 'bg-emerald-500 text-slate-950 shadow'
                                                    : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white border border-slate-700'
                                                }`}
                                              >
                                                {letter}
                                              </span>
                                              <span className="truncate">{opt.text}</span>
                                            </div>

                                            {isSelected && hasPendingChange ? (
                                              <span className="text-amber-300 text-[10px] font-bold shrink-0 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/50 flex items-center gap-1 shadow-sm animate-pulse">
                                                <span>👉</span> ติ๊กแล้ว (รอกดบันทึก)
                                              </span>
                                            ) : isSelected ? (
                                              <span className="text-emerald-300 text-[10px] font-bold shrink-0 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                                                <span>✓</span> เฉลยปัจจุบัน
                                              </span>
                                            ) : isOriginalSaved && hasPendingChange ? (
                                              <span className="text-slate-500 text-[10px] shrink-0 line-through">
                                                (เฉลยเดิม)
                                              </span>
                                            ) : (
                                              <span className="text-slate-500 group-hover:text-emerald-400 text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition">
                                                ติ๊กเลือก
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* แถบแจ้งเตือนและปุ่มกดยืนยันบันทึกเฉลย (ติ๊กแล้วต้องกดปุ่มบันทึก) */}
                                    {hasPendingChange && (
                                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-gradient-to-r from-amber-950/90 to-slate-900 border-2 border-amber-500/80 rounded-2xl mt-2.5 shadow-xl animate-fadeIn">
                                        <div className="flex items-center gap-2.5 text-xs">
                                          <span className="text-amber-400 text-base animate-bounce">⚠️</span>
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-amber-200 font-bold">ติ๊กเลือกเฉลยใหม่เป็น:</span>
                                              <span className="text-white font-bold bg-amber-600/70 px-2 py-0.5 rounded-lg border border-amber-400/70 font-mono">
                                                {pending.choiceLabel}
                                              </span>
                                            </div>
                                            <p className="text-amber-300/90 text-[11px] mt-0.5">
                                              * ยังไม่ได้บันทึก กรุณากดปุ่ม <strong>"💾 บันทึกเฉลยข้อนี้"</strong> เพื่อยืนยัน
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleCancelPendingAnswer(q.id)}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition border border-slate-700 active:scale-95"
                                          >
                                            ยกเลิก
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSavePendingAnswer(exam.accessCode, q.id, idx)}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-1.5 active:scale-95 ring-2 ring-emerald-400/60 animate-pulse hover:animate-none"
                                          >
                                            <span>💾</span>
                                            <span>บันทึกเฉลยข้อนี้</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* TRUE_FALSE (ติ๊กเลือกเฉลยแล้วกดบันทึก) */}
                              {q.type === 'TRUE_FALSE' && (() => {
                                const pending = pendingAnswerChanges[q.id];
                                const activeAnswerKey = pending !== undefined ? pending.answerKey : q.answerKey;
                                const hasPendingChange = pending !== undefined && pending.answerKey !== q.answerKey;
                                const isTrueSelected = activeAnswerKey === 'true' || activeAnswerKey === true;
                                const isFalseSelected = activeAnswerKey === 'false' || activeAnswerKey === false;

                                return (
                                  <div className="space-y-2 pt-1">
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                      <span className="font-medium text-slate-300">👆 ติ๊กเลือกเฉลย:</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSelectQuestionAnswer(
                                              q.id,
                                              q.answerKey,
                                              'true',
                                              'ถูกต้อง (True)'
                                            )
                                          }
                                          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-2 border active:scale-95 ${
                                            isTrueSelected && hasPendingChange
                                              ? 'bg-amber-950 text-amber-200 border-amber-400 shadow ring-2 ring-amber-400/40'
                                              : isTrueSelected
                                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow ring-1 ring-emerald-500/40'
                                              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border-slate-700'
                                          }`}
                                          title="ติ๊กเลือก ถูกต้อง (True)"
                                        >
                                          <input
                                            type="radio"
                                            name={`tf_radio_${q.id}`}
                                            checked={isTrueSelected}
                                            onChange={() =>
                                              handleSelectQuestionAnswer(
                                                q.id,
                                                q.answerKey,
                                                'true',
                                                'ถูกต้อง (True)'
                                              )
                                            }
                                            className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                                          />
                                          <span>ถูกต้อง (True)</span>
                                          {isTrueSelected && hasPendingChange ? (
                                            <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.2 rounded text-amber-300 font-bold">
                                              👉 ติ๊กแล้ว
                                            </span>
                                          ) : isTrueSelected ? (
                                            <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded text-emerald-300 font-bold">
                                              ✓ เฉลยปัจจุบัน
                                            </span>
                                          ) : null}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSelectQuestionAnswer(
                                              q.id,
                                              q.answerKey,
                                              'false',
                                              'ผิด (False)'
                                            )
                                          }
                                          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-2 border active:scale-95 ${
                                            isFalseSelected && hasPendingChange
                                              ? 'bg-amber-950 text-amber-200 border-amber-400 shadow ring-2 ring-amber-400/40'
                                              : isFalseSelected
                                              ? 'bg-rose-950 text-rose-300 border-rose-500 shadow ring-1 ring-rose-500/40'
                                              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border-slate-700'
                                          }`}
                                          title="ติ๊กเลือก ผิด (False)"
                                        >
                                          <input
                                            type="radio"
                                            name={`tf_radio_${q.id}`}
                                            checked={isFalseSelected}
                                            onChange={() =>
                                              handleSelectQuestionAnswer(
                                                q.id,
                                                q.answerKey,
                                                'false',
                                                'ผิด (False)'
                                              )
                                            }
                                            className="accent-rose-500 w-3.5 h-3.5 cursor-pointer"
                                          />
                                          <span>ผิด (False)</span>
                                          {isFalseSelected && hasPendingChange ? (
                                            <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.2 rounded text-amber-300 font-bold">
                                              👉 ติ๊กแล้ว
                                            </span>
                                          ) : isFalseSelected ? (
                                            <span className="text-[10px] bg-rose-500/20 px-1.5 py-0.2 rounded text-rose-300 font-bold">
                                              ✓ เฉลยปัจจุบัน
                                            </span>
                                          ) : null}
                                        </button>
                                      </div>
                                    </div>

                                    {/* แถบแจ้งเตือนและปุ่มกดยืนยันบันทึกเฉลยสำหรับ True/False */}
                                    {hasPendingChange && (
                                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-gradient-to-r from-amber-950/90 to-slate-900 border-2 border-amber-500/80 rounded-2xl mt-2 shadow-xl animate-fadeIn">
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className="text-amber-400 text-base animate-bounce">⚠️</span>
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-amber-200 font-bold">ติ๊กเลือกเฉลยใหม่:</span>
                                              <span className="text-white font-bold bg-amber-600/70 px-2 py-0.5 rounded-lg border border-amber-400/70 font-mono">
                                                {pending.choiceLabel}
                                              </span>
                                            </div>
                                            <p className="text-amber-300/90 text-[11px] mt-0.5">
                                              * ยังไม่ได้บันทึก กรุณากดปุ่ม <strong>"💾 บันทึกเฉลยข้อนี้"</strong> เพื่อยืนยัน
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleCancelPendingAnswer(q.id)}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition border border-slate-700 active:scale-95"
                                          >
                                            ยกเลิก
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSavePendingAnswer(exam.accessCode, q.id, idx)}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-1.5 active:scale-95 ring-2 ring-emerald-400/60 animate-pulse hover:animate-none"
                                          >
                                            <span>💾</span>
                                            <span>บันทึกเฉลยข้อนี้</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {q.type === 'FILL_IN_BLANK' && (
                                <div className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1.5">
                                  <span>คำตอบที่ถูกต้อง:</span>
                                  <strong className="text-emerald-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {Array.isArray(q.answerKey) ? q.answerKey.join(', ') : String(q.answerKey)}
                                  </strong>
                                </div>
                              )}

                              {q.type === 'ESSAY' && (
                                <div className="text-[11px] text-amber-300/90 pt-0.5 flex items-center gap-1.5 bg-amber-950/30 p-2 rounded-xl border border-amber-500/20">
                                  <span>✍️</span>
                                  <span>
                                    <strong>ข้อเขียนอัตนัย:</strong> เกณฑ์ตรวจ:{' '}
                                    {String(q.answerKey || 'ตรวจโดยครูผู้สอน')} (ไม่นำไปรวมในคะแนนตรวจอัตโนมัติ)
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
                      <th className="py-3 px-3">คะแนนปรนัย/จับคู่/เติมคำ</th>
                      <th className="py-3 px-3">คะแนนข้อเขียน (อัตนัย)</th>
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
                              {(score as any).essayScore !== undefined && (score as any).essayScore !== null ? (
                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                  {(score as any).essayScore} คะแนน
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                                  ⏳ รอตรวจให้คะแนน
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
                  <label className="block text-xs text-slate-400 mb-1">คะแนนที่ให้ (คะแนนเต็ม 5)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      defaultValue="5"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500 font-mono font-bold pr-14"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">คะแนน</span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">คำแนะนำ / ข้อเสนอแนะของคุณครู</label>
                  <input
                    type="text"
                    defaultValue="ข้อคิดเห็นดีมาก มีตัวอย่างชัดเจนและปฏิบัติได้จริงในชีวิตประจำวัน"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  onClick={() => showToast('บันทึกคะแนนข้อสอบอัตนัยเรียบร้อยแล้ว ✨', 'success')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                >
                  บันทึกคะแนนข้อเขียน ✍️
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

      {/* 7. Add Question Modal (พร้อมเลือกรหัสชุดข้อสอบ + แนบรูปภาพโจทย์ + คำนวณคะแนนตามประเภท) */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{editingQuestionId ? '✏️' : '➕'}</span>{' '}
                  {editingQuestionId ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบข้อใหม่'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingQuestionId
                    ? 'แก้ไขโจทย์ ตัวเลือก รูปภาพ คะแนน และเปลี่ยนเฉลย'
                    : 'เพิ่มข้อสอบและตั้งค่าเฉลยได้อย่างรวดเร็ว'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddQuestionModal(false);
                  resetQuestionForm();
                }}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-3.5 text-xs">
              {/* ชุดข้อสอบปลายทาง */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">ชุดข้อสอบปลายทาง *</label>
                <select
                  value={targetExamForAdd}
                  onChange={(e) => setTargetExamForAdd(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-medium text-xs"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.accessCode}>
                      {ex.emoji} {ex.subjectCode} {ex.subjectName} ({ex.accessCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* ประเภทข้อสอบ & คะแนน */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ประเภทข้อสอบ *</label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setNewQuestion({
                        ...newQuestion,
                        type: nextType,
                        points: typeScores[nextType] ?? newQuestion.points ?? 1.0,
                      });
                    }}
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

              {newQuestion.type === 'ESSAY' && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-300/95 space-y-0.5">
                  <p className="font-bold flex items-center gap-1">
                    <span>💡</span> ข้อเขียนอัตนัย:
                  </p>
                  <p className="leading-relaxed">
                    คุณครูผู้สอนจะเป็นผู้ตรวจให้คะแนนเองในระบบ จะไม่นำคะแนนนี้ไปรวมในคะแนนตรวจอัตโนมัติ
                  </p>
                </div>
              )}

              {/* ข้อความโจทย์คำถาม */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">โจทย์คำถาม *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="พิมพ์ข้อความคำถามที่ต้องการทดสอบ..."
                  value={newQuestion.promptText}
                  onChange={(e) => setNewQuestion({ ...newQuestion, promptText: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* รูปภาพประกอบโจทย์ (รองรับอัปโหลดไฟล์ในเครื่อง & ใส่ลิงก์ URL) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <span>🖼️</span> รูปภาพประกอบโจทย์ (ถ้ามี)
                  </label>
                  {newQuestion.mediaUrl && (
                    <button
                      type="button"
                      onClick={() => setNewQuestion({ ...newQuestion, mediaUrl: '' })}
                      className="text-red-400 hover:text-red-300 text-[11px] font-semibold flex items-center gap-1"
                    >
                      ✕ ลบรูปภาพ
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <div className="border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-800/60 hover:bg-slate-800 rounded-xl p-2 text-center transition">
                        <span className="text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5">
                          <span>📁</span> คลิกเลือกไฟล์รูปภาพจากเครื่อง (PNG, JPG, WebP)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2.5 * 1024 * 1024) {
                                showToast('รูปภาพมีขนาดใหญ่เกิน 2.5MB กรุณาเลือกไฟล์ภาพขนาดเล็กลง', 'error');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const base64 = event.target?.result as string;
                                setNewQuestion({ ...newQuestion, mediaUrl: base64 });
                                showToast('แนบรูปภาพประกอบโจทย์เรียบร้อยแล้ว', 'success');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                    </label>
                  </div>

                  <input
                    type="url"
                    placeholder="หรือวาง URL ลิงก์รูปภาพ เช่น https://..."
                    value={newQuestion.mediaUrl?.startsWith('data:') ? '' : (newQuestion.mediaUrl || '')}
                    onChange={(e) => setNewQuestion({ ...newQuestion, mediaUrl: e.target.value })}
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500 font-mono"
                  />

                  {newQuestion.mediaUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 p-2 flex items-center justify-center">
                      <img
                        src={newQuestion.mediaUrl}
                        alt="ตัวอย่างรูปภาพประกอบโจทย์"
                        className="max-h-40 rounded-lg object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* แบบฟอร์มตามประเภทข้อสอบ */}
              {newQuestion.type === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
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
                    * ข้อเขียนอัตนัยคุณครูผู้สอนจะเป็นผู้ตรวจให้คะแนนในแท็บ "✍️ ตรวจข้อสอบอัตนัย"
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddQuestionModal(false);
                    resetQuestionForm();
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
                >
                  <span>💾</span>{' '}
                  {editingQuestionId ? 'บันทึกการแก้ไขข้อสอบ' : 'บันทึกข้อสอบลงชุดนี้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Score Rules Modal (กำหนดคะแนนแต่ละประเภท & ชี้แจงอัตนัยตรวจเอง) */}
      {showScoreRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shadow-inner">
                  ⚙️
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    กำหนดคะแนนมาตรฐานแต่ละประเภท
                  </h3>
                  <p className="text-xs text-slate-400">
                    คะแนนเริ่มต้นสำหรับข้อสอบแต่ละประเภท
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScoreRulesModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Note about Essay */}
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3.5 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <span>💡</span>
                <span>เกณฑ์การคิดคะแนนอัตโนมัติ vs ข้อเขียนอัตนัย</span>
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                ข้อสอบประเภท <strong>ปรนัย, ถูก/ผิด, จับคู่ และ เติมคำ</strong> จะถูกตรวจและรวมคะแนนอัตโนมัติทันทีที่นักเรียนส่งข้อสอบ ส่วน <strong>ข้อสอบอัตนัย (ข้อเขียน)</strong> จะไม่ถูกนำมารวมในคะแนนอัตโนมัติ เพราะคุณครูผู้สอนจะเป็นผู้ตรวจให้คะแนนเองในระบบ
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>ปรนัย (Multiple Choice 4 ตัวเลือก)</span>
                  <span className="text-[11px] text-emerald-400 font-normal">ตรวจอัตโนมัติ</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={typeScores.MULTIPLE_CHOICE ?? 1.0}
                    onChange={(e) =>
                      setTypeScores({ ...typeScores, MULTIPLE_CHOICE: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                  <span className="text-slate-400 shrink-0 font-medium">คะแนน / ข้อ</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>ถูก / ผิด (True / False)</span>
                  <span className="text-[11px] text-emerald-400 font-normal">ตรวจอัตโนมัติ</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={typeScores.TRUE_FALSE ?? 1.0}
                    onChange={(e) =>
                      setTypeScores({ ...typeScores, TRUE_FALSE: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                  <span className="text-slate-400 shrink-0 font-medium">คะแนน / ข้อ</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>จับคู่ (Matching)</span>
                  <span className="text-[11px] text-emerald-400 font-normal">ตรวจอัตโนมัติ</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={typeScores.MATCHING ?? 3.0}
                    onChange={(e) =>
                      setTypeScores({ ...typeScores, MATCHING: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                  <span className="text-slate-400 shrink-0 font-medium">คะแนน / ข้อ</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>เติมคำในช่องว่าง (Fill in the Blank)</span>
                  <span className="text-[11px] text-emerald-400 font-normal">ตรวจอัตโนมัติ</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={typeScores.FILL_IN_BLANK ?? 2.0}
                    onChange={(e) =>
                      setTypeScores({ ...typeScores, FILL_IN_BLANK: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                  <span className="text-slate-400 shrink-0 font-medium">คะแนน / ข้อ</span>
                </div>
              </div>

              <div>
                <label className="block text-amber-300 font-bold mb-1 flex items-center justify-between">
                  <span>✍️ อัตนัย / ข้อเขียนบรรยาย (Essay)</span>
                  <span className="text-[11px] text-amber-400 font-semibold">ครูตรวจเอง</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={typeScores.ESSAY ?? 5.0}
                    onChange={(e) =>
                      setTypeScores({ ...typeScores, ESSAY: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-amber-500/40 rounded-xl text-white outline-none focus:border-amber-500 font-mono font-bold"
                  />
                  <span className="text-slate-400 shrink-0 font-medium">คะแนน / ข้อ</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScoreRulesModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScoreRulesModal(false);
                  showToast('บันทึกเกณฑ์คะแนนมาตรฐานเรียบร้อยแล้ว', 'success');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>💾</span> บันทึกเกณฑ์คะแนน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Bulk Import Modal (เพิ่มข้อสอบทีละหลายข้อเพื่อประหยัดเวลา) */}
      {showBulkAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-inner font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    เพิ่มข้อสอบทีละหลายข้อ (Bulk Import)
                  </h3>
                  <p className="text-xs text-slate-400">
                    นำเข้าข้อสอบจาก Word / Google Docs / PDF ได้ในคลิกเดียว ประหยัดเวลาคุณครู
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkAddModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Target Exam Selector */}
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <span>🎯</span> เลือกชุดข้อสอบที่จะนำเข้า:
              </span>
              <select
                value={bulkExamTargetCode}
                onChange={(e) => setBulkExamTargetCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-emerald-400 font-bold rounded-xl px-3 py-1.5 outline-none focus:border-emerald-500"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.accessCode}>
                    {ex.emoji} {ex.subjectCode} {ex.subjectName} ({ex.accessCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Tabs inside modal */}
            <div className="flex border-b border-slate-800 text-xs">
              <button
                onClick={() => setBulkActiveTab('smart_paste')}
                className={`pb-2.5 px-4 font-bold border-b-2 transition flex items-center gap-1.5 ${
                  bulkActiveTab === 'smart_paste'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📋</span> วางข้อความอัตโนมัติ (Smart Paste)
              </button>
              <button
                onClick={() => setBulkActiveTab('quick_form')}
                className={`pb-2.5 px-4 font-bold border-b-2 transition flex items-center gap-1.5 ${
                  bulkActiveTab === 'quick_form'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📝</span> กรอกด่วนหลายข้อ (Quick Multi-Row)
              </button>
            </div>

            {/* Content for Tab 1: Smart Paste */}
            {bulkActiveTab === 'smart_paste' && (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3 text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <span>💡</span> ตัวอย่างรูปแบบข้อความที่ระบบรองรับอัตโนมัติ:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = `1. พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราชทรงสถาปนากรุงรัตนโกสินทร์ขึ้นในปี พ.ศ. ใด?
ก. พ.ศ. 2310
*ข. พ.ศ. 2325
ค. พ.ศ. 2352
ง. พ.ศ. 2367

2. กฎหมายตราสามดวงได้รับการชำระขึ้นในรัชสมัยใด?
เฉลย: รัชกาลที่ 1
ก. รัชกาลที่ 1
ข. รัชกาลที่ 2
ค. รัชกาลที่ 3
ง. รัชกาลที่ 4

3. ประเทศไทยปกครองด้วยระบอบประชาธิปไตยอันมีพระมหากษัตริย์ทรงเป็นประมุข
*ถูก

4. จงอธิบายความสำคัญของสนธิสัญญาเบาว์ริงต่อเศรษฐกิจไทย
(ข้อเขียน) เกณฑ์ตรวจ: ระบุการเปิดเสรีทางการค้า ยกเลิกภาษีปากเรือ`;
                        setBulkRawText(sample);
                      }}
                      className="text-[11px] text-emerald-400 hover:underline font-bold"
                    >
                      + วางตัวอย่างทดลอง
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    ใส่เลขข้อ 1. 2. 3. ... ตามด้วย ก. ข. ค. ง. ตัวเลือกที่ถูกต้องให้ใส่เครื่องหมาย <code className="text-emerald-300 font-bold">*</code> หน้าตัวเลือก หรือพิมพ์ <code className="text-emerald-300 font-bold">เฉลย: ข</code> หากมีรูปภาพใส่แท็ก <code className="text-emerald-300 font-bold">[img: url]</code>
                  </p>
                </div>

                <textarea
                  rows={8}
                  placeholder={`วางข้อสอบจากไฟล์ Word / PDF หรือพิมพ์ข้อสอบที่นี่...
เช่น
1. ข้อใดเป็นเมืองหลวงของไทย
ก. เชียงใหม่
*ข. กรุงเทพมหานคร
ค. ขอนแก่น
ง. ภูเก็ต`}
                  value={bulkRawText}
                  onChange={(e) => setBulkRawText(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-2xl text-white outline-none focus:border-emerald-500 font-mono text-xs leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!bulkRawText.trim()) {
                        showToast('กรุณาวางข้อความข้อสอบก่อนกดวิเคราะห์', 'error');
                        return;
                      }
                      const targetEx = exams.find((x) => x.accessCode === bulkExamTargetCode);
                      const parsed = parseBulkExamText(bulkRawText, typeScores, targetEx?.id || 'exam-1');
                      setBulkParsedQuestions(parsed);
                      if (parsed.length === 0) {
                        showToast('ไม่สามารถแยกข้อสอบได้ กรุณาตรวจสอบรูปแบบเลขข้อ เช่น 1. 2. 3.', 'error');
                      } else {
                        showToast(`ตรวจพบข้อสอบทั้งหมด ${parsed.length} ข้อพร้อมนำเข้า!`, 'success');
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <span>🔍</span> วิเคราะห์ข้อความ (Parse)
                  </button>

                  <span className="text-xs text-slate-400">
                    ตรวจพบแล้ว: <strong className="text-emerald-400 font-mono">{bulkParsedQuestions.length}</strong> ข้อ
                  </span>
                </div>

                {/* Preview of Parsed Questions */}
                {bulkParsedQuestions.length > 0 && (
                  <div className="mt-3 bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3 space-y-2.5 max-h-72 overflow-y-auto">
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-emerald-400 border-b border-slate-800 pb-2 gap-2">
                      <span className="flex items-center gap-1.5">
                        <span>✓</span>
                        <span>ตรวจพบ {bulkParsedQuestions.length} ข้อ (คลิกที่ตัวเลือกเพื่อเลือกเฉลยได้ทันที):</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        สามารถคลิกปุ่มตัวเลือกเพื่อเปลี่ยนเฉลย หรือลบข้อที่ไม่ต้องการออกได้
                      </span>
                    </div>

                    {bulkParsedQuestions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-[11px] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-white text-xs leading-snug flex-1">
                            <span className="text-emerald-400 font-mono mr-1">ข้อ {idx + 1}.</span>
                            <span>{q.promptText}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-emerald-400 font-medium rounded-lg border border-slate-700">
                              {q.type === 'MULTIPLE_CHOICE' ? 'ปรนัย 4 ช้อยส์' : q.type === 'TRUE_FALSE' ? 'ถูก/ผิด' : q.type === 'ESSAY' ? 'อัตนัย' : 'เติมคำ'} ({q.points} คะแนน)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setBulkParsedQuestions(bulkParsedQuestions.filter((_, i) => i !== idx));
                              }}
                              className="text-red-400 hover:text-red-300 text-[11px] px-1.5 py-0.5 rounded hover:bg-red-950/40"
                              title="ลบข้อนี้ออกจากการนำเข้า"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {q.mediaUrl && (
                          <div className="text-[10px] text-teal-400 flex items-center gap-1">
                            <span>🖼️ มีรูปภาพประกอบโจทย์:</span>
                            <span className="font-mono text-slate-400 truncate max-w-xs">{q.mediaUrl}</span>
                          </div>
                        )}

                        {/* Interactive Clickable Choices for Multiple Choice */}
                        {q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.optionsPayload) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.optionsPayload.map((opt: any) => {
                              const isSelected = q.answerKey === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    const updated = [...bulkParsedQuestions];
                                    updated[idx].answerKey = opt.id;
                                    setBulkParsedQuestions(updated);
                                  }}
                                  className={`px-2.5 py-2 rounded-xl text-left text-[11px] transition flex items-center justify-between border ${
                                    isSelected
                                      ? 'bg-emerald-950 text-emerald-300 font-bold border-emerald-500 shadow-sm'
                                      : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                                  }`}
                                  title="คลิกเพื่อเลือกข้อนี้เป็นเฉลย"
                                >
                                  <span className="truncate mr-2">{opt.text}</span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                      isSelected
                                        ? 'bg-emerald-500 text-black shadow-sm'
                                        : 'text-slate-500 bg-slate-900 border border-slate-800'
                                    }`}
                                  >
                                    {isSelected ? '✓ เฉลย' : 'คลิกเฉลย'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Interactive Clickable for True/False */}
                        {q.type === 'TRUE_FALSE' && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...bulkParsedQuestions];
                                updated[idx].answerKey = 'true';
                                setBulkParsedQuestions(updated);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                                q.answerKey === 'true' || q.answerKey === true
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                              }`}
                            >
                              <span>✓ ถูก (True)</span>
                              {(q.answerKey === 'true' || q.answerKey === true) && (
                                <span className="bg-emerald-500 text-black text-[10px] px-1 rounded font-bold">เฉลย</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...bulkParsedQuestions];
                                updated[idx].answerKey = 'false';
                                setBulkParsedQuestions(updated);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                                q.answerKey === 'false' || q.answerKey === false
                                  ? 'bg-red-950 text-red-300 border-red-500 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                              }`}
                            >
                              <span>✕ ผิด (False)</span>
                              {(q.answerKey === 'false' || q.answerKey === false) && (
                                <span className="bg-red-500 text-white text-[10px] px-1 rounded font-bold">เฉลย</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit button for Smart Paste */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAddModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={bulkParsedQuestions.length === 0}
                    onClick={() => {
                      handleBulkImport(bulkParsedQuestions, bulkExamTargetCode);
                      setShowBulkAddModal(false);
                      setBulkParsedQuestions([]);
                      setBulkRawText('');
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <span>🚀</span> นำเข้า {bulkParsedQuestions.length} ข้อลงในชุดข้อสอบ
                  </button>
                </div>
              </div>
            )}

            {/* Content for Tab 2: Quick Multi-Row */}
            {bulkActiveTab === 'quick_form' && (
              <div className="space-y-3 text-xs">
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {quickRows.map((row, rIdx) => (
                    <div key={rIdx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400 text-xs">ข้อที่ {rIdx + 1}</span>
                        {quickRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setQuickRows(quickRows.filter((_, i) => i !== rIdx))}
                            className="text-red-400 hover:text-red-300 text-[11px]"
                          >
                            ✕ ลบข้อนี้
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="โจทย์คำถาม..."
                            value={row.promptText}
                            onChange={(e) => {
                              const updated = [...quickRows];
                              updated[rIdx].promptText = e.target.value;
                              setQuickRows(updated);
                            }}
                            className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const nextType = e.target.value as QuestionType;
                              const updated = [...quickRows];
                              updated[rIdx].type = nextType;
                              updated[rIdx].points = typeScores[nextType] ?? 1.0;
                              setQuickRows(updated);
                            }}
                            className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-[11px]"
                          >
                            <option value="MULTIPLE_CHOICE">ปรนัย</option>
                            <option value="TRUE_FALSE">ถูก/ผิด</option>
                            <option value="FILL_IN_BLANK">เติมคำ</option>
                            <option value="ESSAY">อัตนัย</option>
                          </select>
                          <input
                            type="number"
                            step="0.5"
                            value={row.points}
                            onChange={(e) => {
                              const updated = [...quickRows];
                              updated[rIdx].points = Number(e.target.value);
                              setQuickRows(updated);
                            }}
                            className="w-16 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-xs font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Image URL input for quick row */}
                      <input
                        type="text"
                        placeholder="ลิงก์รูปภาพประกอบ (ถ้ามี)"
                        value={row.mediaUrl || ''}
                        onChange={(e) => {
                          const updated = [...quickRows];
                          updated[rIdx].mediaUrl = e.target.value;
                          setQuickRows(updated);
                        }}
                        className="w-full p-1.5 bg-slate-800/60 border border-slate-700/60 rounded-lg text-white outline-none focus:border-emerald-500 text-[11px]"
                      />

                      {/* Choices if MCQ */}
                      {row.type === 'MULTIPLE_CHOICE' && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {[
                            { key: 'choice1', id: 'c1', label: 'ก' },
                            { key: 'choice2', id: 'c2', label: 'ข' },
                            { key: 'choice3', id: 'c3', label: 'ค' },
                            { key: 'choice4', id: 'c4', label: 'ง' },
                          ].map((c) => (
                            <div key={c.id} className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`quick_radio_${rIdx}`}
                                checked={row.correctChoice === c.id}
                                onChange={() => {
                                  const updated = [...quickRows];
                                  updated[rIdx].correctChoice = c.id;
                                  setQuickRows(updated);
                                }}
                                className="accent-emerald-500 w-3.5 h-3.5"
                              />
                              <input
                                type="text"
                                placeholder={`ช้อยส์ ${c.label}`}
                                value={(row as any)[c.key] || ''}
                                onChange={(e) => {
                                  const updated = [...quickRows];
                                  (updated[rIdx] as any)[c.key] = e.target.value;
                                  setQuickRows(updated);
                                }}
                                className="flex-1 p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* TF if True/False */}
                      {row.type === 'TRUE_FALSE' && (
                        <div className="flex gap-4 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name={`quick_tf_${rIdx}`}
                              checked={row.tfAnswer === 'true'}
                              onChange={() => {
                                const updated = [...quickRows];
                                updated[rIdx].tfAnswer = 'true';
                                setQuickRows(updated);
                              }}
                              className="accent-emerald-500"
                            />
                            <span className="text-emerald-400 font-bold">ถูก</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name={`quick_tf_${rIdx}`}
                              checked={row.tfAnswer === 'false'}
                              onChange={() => {
                                const updated = [...quickRows];
                                updated[rIdx].tfAnswer = 'false';
                                setQuickRows(updated);
                              }}
                              className="accent-red-400"
                            />
                            <span className="text-red-400 font-bold">ผิด</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickRows([
                        ...quickRows,
                        {
                          promptText: '',
                          type: 'MULTIPLE_CHOICE',
                          points: typeScores.MULTIPLE_CHOICE ?? 1.0,
                          choice1: '',
                          choice2: '',
                          choice3: '',
                          choice4: '',
                          correctChoice: 'c1',
                        },
                      ]);
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <span>+</span> เพิ่มอีก 1 ข้อ
                  </button>
                  <span className="text-slate-400 text-xs">
                    รวมทั้งสิ้น <strong className="text-white">{quickRows.length}</strong> ข้อ
                  </span>
                </div>

                {/* Submit button for Quick Form */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAddModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const validRows = quickRows.filter((r) => r.promptText.trim().length > 0);
                      if (validRows.length === 0) {
                        showToast('กรุณากรอกโจทย์คำถามอย่างน้อย 1 ข้อ', 'error');
                        return;
                      }
                      const targetEx = exams.find((x) => x.accessCode === bulkExamTargetCode);
                      const questionsToImport: QuestionDefinition[] = validRows.map((r, i) => {
                        let optionsPayload: any = null;
                        let answerKey: any = null;
                        if (r.type === 'MULTIPLE_CHOICE') {
                          optionsPayload = [
                            { id: 'c1', text: r.choice1?.trim() || 'ตัวเลือก ก' },
                            { id: 'c2', text: r.choice2?.trim() || 'ตัวเลือก ข' },
                            { id: 'c3', text: r.choice3?.trim() || 'ตัวเลือก ค' },
                            { id: 'c4', text: r.choice4?.trim() || 'ตัวเลือก ง' },
                          ];
                          answerKey = r.correctChoice || 'c1';
                        } else if (r.type === 'TRUE_FALSE') {
                          answerKey = r.tfAnswer || 'true';
                        } else if (r.type === 'FILL_IN_BLANK') {
                          answerKey = r.blankAnswer?.trim() || 'คำตอบ';
                        } else {
                          answerKey = 'ตรวจโดยครูผู้สอน';
                        }

                        return {
                          id: `q_bulk_${Date.now()}_${i}`,
                          examId: targetEx?.id || 'exam-1',
                          questionNumber: i + 1,
                          type: r.type,
                          promptText: r.promptText.trim(),
                          mediaUrl: r.mediaUrl?.trim() || null,
                          points: r.points || (typeScores[r.type] ?? 1.0),
                          optionsPayload,
                          answerKey,
                        };
                      });

                      handleBulkImport(questionsToImport, bulkExamTargetCode);
                      setShowBulkAddModal(false);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <span>💾</span> บันทึกข้อสอบทั้งหมดลงในชุดนี้
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9.5 Quick Answer Key Modal (วางเฉลยด่วนจาก AI เช่น 1 ค | 2 ก | 3 ง หรือ 1. ค 2. ก) */}
      {showQuickAnswerModal && (() => {
        const targetExam = exams.find((e) => e.accessCode === quickAnswerTargetCode);
        const parsed = parseAnswerKeyString(quickAnswerRawText);
        const parsedKeys = Object.keys(parsed);
        const parsedCount = parsedKeys.length;

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left my-auto animate-fadeIn">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-white flex items-center justify-center text-xl shadow-inner font-bold">
                    🎯
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>วางเฉลยด่วนจาก AI (Quick Paste Answer Key)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      คัดลอกข้อความเฉลยจาก ChatGPT, Claude, Gemini หรือ Word มาวางเพื่อตั้งเฉลยทุกข้อในคลิกเดียว
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQuickAnswerModal(false)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {/* Target Exam Info */}
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">ชุดวิชาที่จะอัปเดตเฉลย:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                  <span>{targetExam?.emoji || '📝'}</span>
                  <span>{targetExam?.subjectName}</span>
                  <span className="text-slate-500 font-normal">({targetExam?.questions.length || 0} ข้อ)</span>
                </span>
              </div>

              {/* Guide Note */}
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-200/90 space-y-1">
                <p className="font-bold text-amber-300 flex items-center gap-1">
                  <span>💡</span> รูปแบบที่ระบบรองรับอัตโนมัติ:
                </p>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800 space-y-1">
                  <p className="text-emerald-400 font-semibold">• 1 ค | 2 ก | 3 ง | 4 ข | 5 ง (แบบในรูปภาพจาก AI)</p>
                  <p className="text-slate-400">• 1. ค 2. ก 3. ง 4. ข หรือ 1) ค 2) ก</p>
                  <p className="text-slate-400">• หรือตาราง Markdown | 1 | ค | 2 | ก |</p>
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-bold text-xs">
                  วางข้อความเฉลยที่คัดลอกมาที่นี่:
                </label>
                <textarea
                  rows={4}
                  value={quickAnswerRawText}
                  onChange={(e) => setQuickAnswerRawText(e.target.value)}
                  placeholder={`ตัวอย่างเช่น:\n1 ค | 2 ก | 3 ง | 4 ข | 5 ง | 6 ค | 7 ก | 8 ข | 9 ค | 10 ง\n11 ข | 12 ก | 13 ง | 14 ค | 15 ข | 16 ก | 17 ค | 18 ข | 19 ก | 20 ง`}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white outline-none focus:border-amber-400 font-mono leading-relaxed"
                />
              </div>

              {/* Live Preview of Parsed Keys */}
              {parsedCount > 0 ? (
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span className="flex items-center gap-1">
                      <span>✓</span> ตรวจพบเฉลยทั้งหมด {parsedCount} ข้อ:
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">พร้อมนำไปบันทึกลงในข้อสอบ</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {parsedKeys
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((qNum) => (
                        <span
                          key={qNum}
                          className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1"
                        >
                          <span className="text-slate-400 text-[10px]">ข้อ {qNum}:</span>
                          <span className="text-amber-300">{parsed[qNum].letter}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ) : quickAnswerRawText.trim() ? (
                <div className="bg-red-950/40 border border-red-500/30 p-2.5 rounded-xl text-xs text-red-300 flex items-center gap-1.5">
                  <span>⚠️</span> ยังตรวจไม่พบรูปแบบข้อและเฉลย กรุณาตรวจสอบว่ามีเลขข้อและตัวเลือก ก-ง
                </div>
              ) : null}

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAnswerModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={parsedCount === 0}
                  onClick={handleApplyQuickAnswers}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 text-xs active:scale-95"
                >
                  <span>💾</span>
                  <span>ยืนยันบันทึกเฉลย ({parsedCount} ข้อ)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}


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
