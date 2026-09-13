import { QuestionDefinition } from '../types/exam';

export interface ExamRecord {
  id: string;
  accessCode: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  description: string;
  durationMinutes: number;
  emoji: string;
  classrooms: Array<{ id: string; gradeLevel: string; roomNumber: string }>;
  maxViolations: number;
  totalStudents: number;
  status: 'PUBLISHED' | 'DRAFT';
  isOpen: boolean;                // สวิตช์ เปิด/ปิดรับคำตอบ
  shuffleQuestions?: boolean;     // สลับข้อสอบ
  shuffleChoices?: boolean;       // สลับตัวเลือก
  questions: QuestionDefinition[];
}

/**
 * สลับลำดับสมาชิกใน Array แบบสุ่ม (Fisher-Yates Shuffle)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const INITIAL_EXAMS: ExamRecord[] = [
  {
    id: 'ex-soc-01',
    accessCode: 'EXAM-SOC-01',
    subjectCode: 'ส21101',
    subjectName: 'สังคมศึกษา ศาสนา และวัฒนธรรม 1',
    title: 'แบบทดสอบกลางภาคเรียนที่ 1/2569 (หน่วยหน้าที่พลเมืองและกฎหมายในชีวิตประจำวัน)',
    description: 'การปฏิบัติตนตามกฎหมาย สิทธิมนุษยชน และการมีส่วนร่วมในระบอบประชาธิปไตย ชั้น ม.1',
    durationMinutes: 60,
    emoji: '🏛️',
    isOpen: true,
    shuffleQuestions: true,
    shuffleChoices: true,
    classrooms: [
      { id: 'c1', gradeLevel: 'ม.1', roomNumber: '1' },
      { id: 'c2', gradeLevel: 'ม.1', roomNumber: '2' },
      { id: 'c3', gradeLevel: 'ม.1', roomNumber: '3' },
    ],
    maxViolations: 3,
    totalStudents: 45,
    status: 'PUBLISHED',
    questions: [
      {
        id: 'sq1',
        examId: 'ex-soc-01',
        questionNumber: 1,
        type: 'MULTIPLE_CHOICE',
        promptText: 'กฎหมายสูงสุดในการปกครองประเทศไทยคือข้อใด?',
        points: 1.0,
        optionsPayload: [
          { id: 'c1', text: 'พระราชบัญญัติ' },
          { id: 'c2', text: 'รัฐธรรมนูญแห่งราชอาณาจักรไทย' },
          { id: 'c3', text: 'ประมวลกฎหมายแพ่งและพาณิชย์' },
          { id: 'c4', text: 'พระราชกำหนด' },
        ],
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
      {
        id: 'sq3',
        examId: 'ex-soc-01',
        questionNumber: 3,
        type: 'FILL_IN_BLANK',
        promptText: 'หลักธรรมทางพระพุทธศาสนาที่เป็นเครื่องยึดเหนี่ยวจิตใจและสร้างความสามัคคีในสังคม 4 ประการ เรียกว่าอะไร?',
        points: 2.0,
        answerKey: ['สังคหวัตถุ 4', 'สังคหวัตถุ4', 'สังคหวัตถุ'],
      },
      {
        id: 'sq4',
        examId: 'ex-soc-01',
        questionNumber: 4,
        type: 'MATCHING',
        promptText: 'จับคู่อำนาจอธิปไตยกับองค์กรที่ใช้อำนาจให้ถูกต้อง',
        points: 3.0,
        optionsPayload: {
          left: [
            { id: 'l1', text: 'อำนาจนิติบัญญัติ' },
            { id: 'l2', text: 'อำนาจบริหาร' },
            { id: 'l3', text: 'อำนาจตุลาการ' },
          ],
          right: [
            { id: 'r1', text: 'รัฐสภา (สภาผู้แทนราษฎรและวุฒิสภา)' },
            { id: 'r2', text: 'คณะรัฐมนตรี (นายกรัฐมนตรี)' },
            { id: 'r3', text: 'ศาลยุติธรรมและศาลต่างๆ' },
          ],
        },
        answerKey: { l1: 'r1', l2: 'r2', l3: 'r3' },
      },
      {
        id: 'sq5',
        examId: 'ex-soc-01',
        questionNumber: 5,
        type: 'ESSAY',
        promptText: 'ในฐานะเยาวชน ให้นักเรียนเสนอแนวทางการปฏิบัติตนเพื่อส่งเสริมความซื่อสัตย์สุจริตและป้องกันการทุจริตในโรงเรียนอย่างน้อย 3 ข้อ',
        points: 5.0,
      },
    ],
  },
  {
    id: 'ex-his-01',
    accessCode: 'EXAM-HIS-01',
    subjectCode: 'ส21102',
    subjectName: 'ประวัติศาสตร์ 1',
    title: 'แบบทดสอบเก็บคะแนน เรื่อง พัฒนาการของอาณาจักรสุโขทัยและอยุธยา',
    description: 'การสถาปนา การเมืองการปกครอง ศิลปวัฒนธรรม และบุคคลสำคัญ ชั้น ม.1',
    durationMinutes: 50,
    emoji: '📜',
    isOpen: true,
    shuffleQuestions: true,
    shuffleChoices: true,
    classrooms: [
      { id: 'c1', gradeLevel: 'ม.1', roomNumber: '1' },
      { id: 'c2', gradeLevel: 'ม.1', roomNumber: '2' },
    ],
    maxViolations: 3,
    totalStudents: 40,
    status: 'PUBLISHED',
    questions: [
      {
        id: 'hq1',
        examId: 'ex-his-01',
        questionNumber: 1,
        type: 'MULTIPLE_CHOICE',
        promptText: 'พระมหากษัตริย์ผู้ทรงประดิษฐ์อักษรไทยขึ้นในสมัยสุโขทัยคือใคร?',
        points: 1.0,
        optionsPayload: [
          { id: 'c1', text: 'พ่อขุนศรีอินทราทิตย์' },
          { id: 'c2', text: 'พ่อขุนรามคำแหงมหาราช' },
          { id: 'c3', text: 'พระมหาธรรมราชาที่ 1 (ลิไทย)' },
          { id: 'c4', text: 'สมเด็จพระรามาธิบดีที่ 1 (อู่ทอง)' },
        ],
        answerKey: 'c2',
      },
      {
        id: 'hq2',
        examId: 'ex-his-01',
        questionNumber: 2,
        type: 'TRUE_FALSE',
        promptText: 'การปกครองสมัยสุโขทัยตอนต้นมีลักษณะแบบ "พ่อปกครองลูก"',
        points: 1.0,
        answerKey: 'true',
      },
    ],
  },
  {
    id: 'ex-anti-01',
    accessCode: 'EXAM-ANTI-01',
    subjectCode: 'ทุจริตศึกษา',
    subjectName: 'การป้องกันการทุจริต (Anti-Corruption)',
    title: 'แบบประเมินความรู้ เรื่อง STRONG: จิตพอเพียงต้านทุจริต',
    description: 'การแยกแยะระหว่างประโยชน์ส่วนตนกับประโยชน์ส่วนรวม และความละอายต่อการทุจริต',
    durationMinutes: 40,
    emoji: '⚖️',
    isOpen: true,
    shuffleQuestions: true,
    shuffleChoices: true,
    classrooms: [
      { id: 'c1', gradeLevel: 'ม.1', roomNumber: '1' },
      { id: 'c2', gradeLevel: 'ม.1', roomNumber: '2' },
    ],
    maxViolations: 2,
    totalStudents: 38,
    status: 'PUBLISHED',
    questions: [
      {
        id: 'aq1',
        examId: 'ex-anti-01',
        questionNumber: 1,
        type: 'MULTIPLE_CHOICE',
        promptText: 'ข้อใดเป็นการกระทำที่สะท้อนถึงการแยกแยะประโยชน์ส่วนตนและประโยชน์ส่วนรวมได้อย่างถูกต้อง?',
        points: 1.0,
        optionsPayload: [
          { id: 'c1', text: 'นำรถยนต์ของทางราชการไปเที่ยวพักผ่อนกับครอบครัว' },
          { id: 'c2', text: 'ไม่ลอกการบ้านเพื่อนและไม่ให้เพื่อนลอกข้อสอบ' },
          { id: 'c3', text: 'นำกระดาษรายงานของโรงเรียนกลับไปใช้ส่วนตัวที่บ้าน' },
          { id: 'c4', text: 'ใช้เวลาเรียนเล่นเกมออนไลน์' },
        ],
        answerKey: 'c2',
      },
      {
        id: 'aq2',
        examId: 'ex-anti-01',
        questionNumber: 2,
        type: 'FILL_IN_BLANK',
        promptText: 'ตัวอักษร R ในโมเดล STRONG : จิตพอเพียงต้านทุจริต ย่อมาจากคำภาษาอังกฤษว่าอะไร?',
        points: 2.0,
        answerKey: ['Realise', 'realise', 'Realize', 'realize'],
      },
    ],
  },
];

export function getAllExams(): ExamRecord[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('krusos_exams_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load exams from localStorage:', e);
    }
  }
  return INITIAL_EXAMS;
}

export function saveExamsToStorage(exams: ExamRecord[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('krusos_exams_data', JSON.stringify(exams));
    } catch (e) {
      console.error('Failed to save exams to localStorage:', e);
    }
  }
}

export function getExamByAccessCode(code: string): ExamRecord | undefined {
  const clean = code.trim().toUpperCase();
  const all = getAllExams();
  return all.find((e) => e.accessCode.toUpperCase() === clean);
}
