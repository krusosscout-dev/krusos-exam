import {
  QuestionDefinition,
  StudentAnswerPayload,
  AutoGradingResult,
  OverallGradingSummary,
  SessionStatus,
} from '../types/exam';

/**
 * Normalizes text for fill-in-the-blank comparison:
 * - Removes leading/trailing whitespaces
 * - Collapses multiple internal spaces into a single space
 * - Lowercases strings
 */
function normalizeString(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Evaluates individual auto-graded question and calculates points awarded.
 */
export function evaluateQuestionAnswer(
  question: QuestionDefinition,
  studentAnswer: StudentAnswerPayload | undefined
): AutoGradingResult {
  const maxPoints = question.points ?? 1.0;
  const userResponse = studentAnswer?.response;

  // If no answer was submitted
  if (userResponse === undefined || userResponse === null || userResponse === '') {
    if (question.type === 'ESSAY') {
      return {
        questionId: question.id,
        isAutoGraded: false,
        scoreAwarded: 0,
        maxPoints,
        isCorrect: false,
        needsManualReview: true,
      };
    }
    return {
      questionId: question.id,
      isAutoGraded: true,
      scoreAwarded: 0,
      maxPoints,
      isCorrect: false,
      needsManualReview: false,
    };
  }

  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      // answerKey format: string e.g. "c2" or array of allowed IDs e.g. ["c2"]
      const allowedKeys: string[] = Array.isArray(question.answerKey)
        ? question.answerKey
        : [String(question.answerKey)];

      const isCorrect = allowedKeys.includes(String(userResponse));
      return {
        questionId: question.id,
        isAutoGraded: true,
        scoreAwarded: isCorrect ? maxPoints : 0,
        maxPoints,
        isCorrect,
        needsManualReview: false,
      };
    }

    case 'TRUE_FALSE': {
      const normalizedUser = String(userResponse).toLowerCase();
      const normalizedKey = String(question.answerKey).toLowerCase();
      const isCorrect = normalizedUser === normalizedKey;

      return {
        questionId: question.id,
        isAutoGraded: true,
        scoreAwarded: isCorrect ? maxPoints : 0,
        maxPoints,
        isCorrect,
        needsManualReview: false,
      };
    }

    case 'FILL_IN_BLANK': {
      // answerKey can be:
      // 1. Array of acceptable answers: ["mitochondria", "ไมโทคอนเดรีย"]
      // 2. Single string: "photosynthesis"
      // 3. Object with regex: { regex: "^(dna|ดีเอ็นเอ)$", caseSensitive: false }
      let isCorrect = false;
      const cleanUserResponse = normalizeString(String(userResponse));

      if (typeof question.answerKey === 'object' && question.answerKey !== null && !Array.isArray(question.answerKey) && question.answerKey.regex) {
        const regex = new RegExp(question.answerKey.regex, question.answerKey.caseSensitive ? '' : 'i');
        isCorrect = regex.test(String(userResponse).trim());
      } else {
        const validAnswers: string[] = Array.isArray(question.answerKey)
          ? question.answerKey.map((a: any) => normalizeString(String(a)))
          : [normalizeString(String(question.answerKey))];

        isCorrect = validAnswers.includes(cleanUserResponse);
      }

      return {
        questionId: question.id,
        isAutoGraded: true,
        scoreAwarded: isCorrect ? maxPoints : 0,
        maxPoints,
        isCorrect,
        needsManualReview: false,
      };
    }

    case 'MATCHING': {
      // answerKey format: Record<string, string> e.g. { "l1": "r3", "l2": "r1", "l3": "r2" }
      // userResponse format: Record<string, string>
      const keyMap: Record<string, string> = question.answerKey || {};
      const userMap: Record<string, string> = typeof userResponse === 'object' && !Array.isArray(userResponse)
        ? (userResponse as Record<string, string>)
        : {};

      const totalPairs = Object.keys(keyMap).length;
      if (totalPairs === 0) {
        return {
          questionId: question.id,
          isAutoGraded: true,
          scoreAwarded: 0,
          maxPoints,
          isCorrect: false,
          needsManualReview: false,
        };
      }

      let correctPairsCount = 0;
      for (const [leftKey, expectedRight] of Object.entries(keyMap)) {
        if (userMap[leftKey] === expectedRight) {
          correctPairsCount++;
        }
      }

      // Proportional scoring based on correct matched pairs
      const pointsPerPair = maxPoints / totalPairs;
      const awardedPoints = Number((correctPairsCount * pointsPerPair).toFixed(2));
      const isFullyCorrect = correctPairsCount === totalPairs;

      return {
        questionId: question.id,
        isAutoGraded: true,
        scoreAwarded: awardedPoints,
        maxPoints,
        isCorrect: isFullyCorrect,
        needsManualReview: false,
      };
    }

    case 'ESSAY':
    default: {
      // Essay questions cannot be auto-graded. Require manual teacher review.
      return {
        questionId: question.id,
        isAutoGraded: false,
        scoreAwarded: 0,
        maxPoints,
        isCorrect: null,
        needsManualReview: true,
      };
    }
  }
}

/**
 * Main Grading Engine execution function.
 * Evaluates all questions, sums scores, and determines new session status.
 */
export function gradeStudentSubmission(
  sessionId: string,
  questions: QuestionDefinition[],
  submittedAnswers: StudentAnswerPayload[],
  isForcedSubmission: boolean = false
): OverallGradingSummary {
  const answerMap = new Map<string, StudentAnswerPayload>();
  for (const ans of submittedAnswers) {
    answerMap.set(ans.questionId, ans);
  }

  let autoGradedScore = 0;
  let hasManualQuestions = false;
  let objectiveScore = 0;
  let objectiveMaxPoints = 0;
  let essayMaxPoints = 0;
  const questionResults: AutoGradingResult[] = [];

  for (const q of questions) {
    const studentAns = answerMap.get(q.id);
    const result = evaluateQuestionAnswer(q, studentAns);
    questionResults.push(result);

    // ข้อสอบตรวจอัตโนมัติทันที: ปรนัย (MCQ), จับคู่ (MATCHING), ถูก/ผิด (TRUE_FALSE), เติมคำ (FILL_IN_BLANK)
    const isObjectiveType = q.type !== 'ESSAY';

    if (isObjectiveType) {
      objectiveScore += result.scoreAwarded;
      objectiveMaxPoints += result.maxPoints;
    } else {
      // ข้อสอบอัตนัย (ข้อเขียน): ครูเป็นผู้ตรวจให้คะแนนภายหลัง
      hasManualQuestions = true;
      essayMaxPoints += result.maxPoints;
    }

    if (result.isAutoGraded) {
      autoGradedScore += result.scoreAwarded;
    }
  }

  // Round scores to 2 decimal places
  autoGradedScore = Number(autoGradedScore.toFixed(2));
  objectiveScore = Number(objectiveScore.toFixed(2));
  objectiveMaxPoints = Number(objectiveMaxPoints.toFixed(2));
  essayMaxPoints = Number(essayMaxPoints.toFixed(2));

  const hasEssay = questions.some((q) => q.type === 'ESSAY');

  let finalStatus: SessionStatus;
  if (isForcedSubmission) {
    finalStatus = 'FORCE_TERMINATED';
  } else if (hasManualQuestions) {
    finalStatus = 'SUBMITTED'; // รอคุณครูตรวจข้อเขียน
  } else {
    finalStatus = 'GRADED'; // ตรวจครบเสร็จสิ้น 100%
  }

  return {
    sessionId,
    autoGradedScore,
    manualGradedScore: 0,
    totalScore: autoGradedScore,
    objectiveScore,
    objectiveMaxPoints,
    hasEssay,
    essayMaxPoints,
    supplementaryStatus: hasEssay ? 'PENDING' : 'PASS',
    allAutoGraded: !hasManualQuestions,
    status: finalStatus,
    questionResults,
  };
}

/**
 * Validates server-side expiration timestamp against current server time
 * to prevent client-side clock tampering.
 */
export function validateSessionDeadline(
  expiresAt: Date,
  gracePeriodSeconds: number = 30
): { isValid: boolean; lateSeconds: number } {
  const now = Date.now();
  const allowedDeadline = new Date(expiresAt).getTime() + gracePeriodSeconds * 1000;
  const lateSeconds = Math.max(0, Math.floor((now - allowedDeadline) / 1000));

  return {
    isValid: now <= allowedDeadline,
    lateSeconds,
  };
}
