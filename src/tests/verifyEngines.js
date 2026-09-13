// Standalone verification script for Grading Engine and Item Analysis algorithms
function normalizeString(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function evaluateQuestionAnswer(question, studentAnswer) {
  const maxPoints = question.points ?? 1.0;
  const userResponse = studentAnswer?.response;

  if (userResponse === undefined || userResponse === null || userResponse === '') {
    return {
      questionId: question.id,
      isAutoGraded: question.type !== 'ESSAY',
      scoreAwarded: 0,
      maxPoints,
      isCorrect: false,
      needsManualReview: question.type === 'ESSAY',
    };
  }

  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const allowedKeys = Array.isArray(question.answerKey)
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
      const isCorrect = String(userResponse).toLowerCase() === String(question.answerKey).toLowerCase();
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
      let isCorrect = false;
      const cleanUserResponse = normalizeString(String(userResponse));
      const validAnswers = Array.isArray(question.answerKey)
        ? question.answerKey.map((a) => normalizeString(String(a)))
        : [normalizeString(String(question.answerKey))];

      isCorrect = validAnswers.includes(cleanUserResponse);
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
      const keyMap = question.answerKey || {};
      const userMap = typeof userResponse === 'object' ? userResponse : {};
      const totalPairs = Object.keys(keyMap).length;
      if (totalPairs === 0) return { questionId: question.id, scoreAwarded: 0, isCorrect: false };

      let correctPairsCount = 0;
      for (const [k, v] of Object.entries(keyMap)) {
        if (userMap[k] === v) correctPairsCount++;
      }
      const pointsPerPair = maxPoints / totalPairs;
      const score = Number((correctPairsCount * pointsPerPair).toFixed(2));
      return {
        questionId: question.id,
        isAutoGraded: true,
        scoreAwarded: score,
        maxPoints,
        isCorrect: correctPairsCount === totalPairs,
        needsManualReview: false,
      };
    }

    case 'ESSAY':
    default:
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

function calculateDescriptiveStats(scores) {
  const n = scores.length;
  if (n === 0) return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  const sorted = [...scores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Number((sum / n).toFixed(2));

  let median;
  const mid = Math.floor(n / 2);
  if (n % 2 === 0) {
    median = Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  } else {
    median = sorted[mid];
  }

  const varianceSum = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const stdDev = n > 1 ? Number(Math.sqrt(varianceSum / (n - 1)).toFixed(2)) : 0;
  return { mean, median, min, max, stdDev };
}

function performItemAnalysis(questions, studentRecords) {
  const totalStudents = studentRecords.length;
  const sortedRecords = [...studentRecords].sort((a, b) => b.totalScore - a.totalScore);
  const ratio = totalStudents < 30 ? 0.50 : 0.27;
  const groupSize = Math.max(1, Math.round(totalStudents * ratio));

  const highGroup = sortedRecords.slice(0, groupSize);
  const lowGroup = sortedRecords.slice(totalStudents - groupSize);

  return questions.filter(q => q.type !== 'ESSAY').map((question) => {
    let rh = 0;
    let rl = 0;

    for (const r of highGroup) {
      if (r.answers[question.id]?.isCorrect) rh++;
    }
    for (const r of lowGroup) {
      if (r.answers[question.id]?.isCorrect) rl++;
    }

    const nh = groupSize;
    const nl = groupSize;
    const p = Number(((rh + rl) / (nh + nl)).toFixed(2));
    const r = Number(((rh - rl) / nh).toFixed(2));

    return {
      questionId: question.id,
      difficultyIndex: p,
      discriminationIndex: r,
      nh,
      nl,
      rh,
      rl,
    };
  });
}

// -------------------------------------------------------------
// RUNNING UNIT TESTS
// -------------------------------------------------------------
console.log('=== TEST 1: Grading Engine ===');
const qMCQ = { id: 'q1', type: 'MULTIPLE_CHOICE', points: 1, answerKey: 'c2' };
const qTF = { id: 'q2', type: 'TRUE_FALSE', points: 1, answerKey: 'false' };
const qFill = { id: 'q3', type: 'FILL_IN_BLANK', points: 2, answerKey: ['mitochondria', 'ไมโทคอนเดรีย'] };
const qMatch = { id: 'q4', type: 'MATCHING', points: 2, answerKey: { a: '1', b: '2' } };
const qEssay = { id: 'q5', type: 'ESSAY', points: 5 };

console.log('MCQ Correct:', evaluateQuestionAnswer(qMCQ, { response: 'c2' }).scoreAwarded === 1);
console.log('TF Correct:', evaluateQuestionAnswer(qTF, { response: 'false' }).scoreAwarded === 1);
console.log('Fill Correct (Thai):', evaluateQuestionAnswer(qFill, { response: ' ไมโทคอนเดรีย ' }).scoreAwarded === 2);
console.log('Match Partial:', evaluateQuestionAnswer(qMatch, { response: { a: '1', b: 'wrong' } }).scoreAwarded === 1);
console.log('Essay Needs Manual Review:', evaluateQuestionAnswer(qEssay, { response: 'Hello world' }).needsManualReview === true);

console.log('\n=== TEST 2: Descriptive Statistics ===');
const sampleScores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const stats = calculateDescriptiveStats(sampleScores);
console.log('Scores:', sampleScores);
console.log('Stats Result:', stats);

console.log('\n=== TEST 3: Item Analysis (p & r) ===');
// Simulating 10 students
const mockRecords = [];
for (let i = 1; i <= 10; i++) {
  // Students with higher index have higher score
  const isHighGroup = i > 5;
  mockRecords.push({
    sessionId: `s${i}`,
    totalScore: i * 10,
    answers: {
      q1: { isCorrect: isHighGroup ? true : (i === 1) }, // High group got it right, only 1 low got it right
    },
  });
}
const itemStats = performItemAnalysis([qMCQ], mockRecords);
console.log('Item Analysis Result:', itemStats);
console.log('p value:', itemStats[0].difficultyIndex, 'r value:', itemStats[0].discriminationIndex);
console.log('ALL TESTS EXECUTED SUCCESSFULLY!');
