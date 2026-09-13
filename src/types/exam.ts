export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_IN_BLANK'
  | 'MATCHING'
  | 'ESSAY';

export type SessionStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'GRADED'
  | 'FORCE_TERMINATED'
  | 'TIMED_OUT';

export type ViolationType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'CLIPBOARD_ATTEMPT'
  | 'DEVTOOLS_OPEN'
  | 'SUSPICIOUS_KEY';

export interface ChoiceOption {
  id: string;
  text: string;
  mediaUrl?: string;
}

export interface MatchingOptionPayload {
  left: Array<{ id: string; text: string }>;
  right: Array<{ id: string; text: string }>;
}

export interface QuestionDefinition {
  id: string;
  examId: string;
  questionNumber: number;
  type: QuestionType;
  promptText: string;
  mediaUrl?: string | null;
  points: number;
  optionsPayload?: ChoiceOption[] | MatchingOptionPayload | any;
  answerKey?: any; // Stored securely on server only
}

export interface StudentAnswerPayload {
  questionId: string;
  // Multiple Choice: choice ID "c1"
  // True/False: boolean or string "true" / "false"
  // Fill in blank: text string "mitochondria"
  // Matching: Record<string, string> e.g. { "l1": "r2", "l2": "r1" }
  // Essay: text string
  response: string | Record<string, string> | null;
}

export interface StudentSubmissionRequest {
  sessionId: string;
  answers: StudentAnswerPayload[];
  isForcedSubmission?: boolean;
}

export interface AutoGradingResult {
  questionId: string;
  isAutoGraded: boolean;
  scoreAwarded: number;
  maxPoints: number;
  isCorrect: boolean | null; // null for essay
  needsManualReview: boolean;
}

export interface OverallGradingSummary {
  sessionId: string;
  autoGradedScore: number;
  manualGradedScore: number;
  totalScore: number;
  allAutoGraded: boolean;
  status: SessionStatus;
  questionResults: AutoGradingResult[];
}

export interface ItemAnalysisResult {
  questionId: string;
  questionNumber: number;
  type: QuestionType;
  promptText: string;
  totalStudents: number;
  highGroupCount: number;
  lowGroupCount: number;
  difficultyIndex: number;      // p: 0.00 to 1.00
  difficultyLabel: string;      // ความยาก: ง่ายมาก, ปานกลาง, ยาก ฯลฯ
  discriminationIndex: number;  // r: -1.00 to +1.00
  discriminationLabel: string;  // อำนาจจำแนก: ดีมาก, พอใช้, ต้องปรับปรุง, ควรตัดทิ้ง
  distractorAnalysis?: Array<{
    optionId: string;
    text: string;
    isCorrect: boolean;
    highGroupSelected: number;
    lowGroupSelected: number;
    totalSelected: number;
    selectionPercentage: number;
    assessment: string; // เช่น "ตัวลวงทำงานได้ดี", "ตัวลวงไม่มีประสิทธิภาพ", "ตัวลวงลวงคนเก่งมากกว่าคนอ่อน"
  }>;
}

export interface ClassroomCohortStats {
  classroomId: string;
  gradeLevel: string;
  roomNumber: string;
  studentCount: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
}
