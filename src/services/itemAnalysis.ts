import {
  QuestionDefinition,
  ItemAnalysisResult,
  ClassroomCohortStats,
} from '../types/exam';

interface StudentExamRecord {
  sessionId: string;
  studentId: string;
  classroomId: string;
  totalScore: number;
  answers: Map<string, {
    response: any;
    isCorrect: boolean;
    scoreAwarded: number;
  }>;
}

/**
 * แปลผลค่าความยากง่าย (p) ตามหลักวัดและประเมินผลการศึกษา
 */
export function interpretDifficulty(p: number): string {
  if (p < 0.20) return 'ยากมาก (ควรปรับปรุง)';
  if (p <= 0.39) return 'ค่อนข้างยาก (พอใช้ได้)';
  if (p <= 0.59) return 'ยากง่ายพอเหมาะ (ดีมาก)';
  if (p <= 0.79) return 'ค่อนข้างง่าย (พอใช้ได้)';
  return 'ง่ายมาก (ควรปรับปรุง)';
}

/**
 * แปลผลค่าอำนาจจำแนก (r) ตามหลักวัดและประเมินผลการศึกษา
 */
export function interpretDiscrimination(r: number): string {
  if (r >= 0.40) return 'จำแนกได้ดีมาก';
  if (r >= 0.30) return 'จำแนกได้ดี';
  if (r >= 0.20) return 'จำแนกพอใช้ (ควรปรับปรุง)';
  if (r >= 0.00) return 'จำแนกได้ไม่ดี (ควรตัดทิ้งหรือแก้ไข)';
  return 'อำนาจจำแนกติดลบ (เฉลยผิดหรือข้อสอบมีข้อบกพร่องร้ายแรง)';
}

/**
 * คำนวณสถิติพื้นฐาน (Mean, Median, Min, Max, SD) สำหรับคะแนนสอบ
 */
export function calculateDescriptiveStats(scores: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
} {
  const n = scores.length;
  if (n === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Mean
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Number((sum / n).toFixed(2));

  // Median
  let median: number;
  const mid = Math.floor(n / 2);
  if (n % 2 === 0) {
    median = Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  } else {
    median = sorted[mid];
  }

  // Standard Deviation (Sample Standard Deviation)
  if (n <= 1) {
    return { mean, median, min, max, stdDev: 0 };
  }
  const varianceSum = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const stdDev = Number(Math.sqrt(varianceSum / (n - 1)).toFixed(2));

  return { mean, median, min, max, stdDev };
}

/**
 * คำนวณการวิเคราะห์คุณภาพข้อสอบรายข้อ (Item Analysis)
 * ใช้ทฤษฎีการทดสอบแบบดั้งเดิม (Classical Test Theory - CTT)
 * แบ่งกลุ่มสูง-กลุ่มต่ำด้วยเทคนิค 27% (Kelley's 27% Rule)
 */
export function performItemAnalysis(
  questions: QuestionDefinition[],
  studentRecords: StudentExamRecord[]
): ItemAnalysisResult[] {
  const totalStudents = studentRecords.length;
  if (totalStudents === 0) return [];

  // เรียงลำดับนักเรียนจากคะแนนรวมมากไปน้อย
  const sortedRecords = [...studentRecords].sort((a, b) => b.totalScore - a.totalScore);

  // กำหนดสัดส่วน 27% บนและ 27% ล่าง (หากนักเรียนน้อยกว่า 30 คนให้ใช้ 50% split)
  const ratio = totalStudents < 30 ? 0.50 : 0.27;
  const groupSize = Math.max(1, Math.round(totalStudents * ratio));

  const highGroup = sortedRecords.slice(0, groupSize);
  const lowGroup = sortedRecords.slice(totalStudents - groupSize);

  const results: ItemAnalysisResult[] = [];

  for (const question of questions) {
    // ข้ามข้ออัตนัย (Essay) เนื่องจากวิเคราะห์ด้วย p, r ปรนัยไม่ได้โดยตรง
    if (question.type === 'ESSAY') {
      continue;
    }

    // นับจำนวนคนที่ตอบถูกในกลุ่มสูง (RH) และกลุ่มต่ำ (RL)
    let rh = 0;
    let rl = 0;

    // การเก็บข้อมูลสถิติตัวเลือก (Distractor Analysis) สำหรับ Multiple Choice
    const optionCounts: Record<
      string,
      { high: number; low: number; total: number }
    > = {};

    if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(question.optionsPayload)) {
      question.optionsPayload.forEach((opt: any) => {
        optionCounts[opt.id] = { high: 0, low: 0, total: 0 };
      });
    }

    // คำนวณกลุ่มสูง
    for (const record of highGroup) {
      const ans = record.answers.get(question.id);
      if (ans?.isCorrect) {
        rh++;
      }
      if (ans?.response && optionCounts[String(ans.response)]) {
        optionCounts[String(ans.response)].high++;
        optionCounts[String(ans.response)].total++;
      }
    }

    // คำนวณกลุ่มต่ำ
    for (const record of lowGroup) {
      const ans = record.answers.get(question.id);
      if (ans?.isCorrect) {
        rl++;
      }
      if (ans?.response && optionCounts[String(ans.response)]) {
        optionCounts[String(ans.response)].low++;
        optionCounts[String(ans.response)].total++;
      }
    }

    // นับกลุ่มตรงกลางเพื่อเติม total ของ option
    const middleGroup = sortedRecords.slice(groupSize, totalStudents - groupSize);
    for (const record of middleGroup) {
      const ans = record.answers.get(question.id);
      if (ans?.response && optionCounts[String(ans.response)]) {
        optionCounts[String(ans.response)].total++;
      }
    }

    const nh = groupSize;
    const nl = groupSize;

    // สูตรคำนวณค่าความยากง่าย (Difficulty Index: p)
    // p = (RH + RL) / (NH + NL)
    const p = Number(((rh + rl) / (nh + nl)).toFixed(2));

    // สูตรคำนวณค่าอำนาจจำแนก (Discrimination Index: r)
    // r = (RH - RL) / NH
    const r = Number(((rh - rl) / nh).toFixed(2));

    // ประมวลผล Distractor Analysis
    let distractorAnalysis: ItemAnalysisResult['distractorAnalysis'];
    if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(question.optionsPayload)) {
      const allowedKeys = Array.isArray(question.answerKey)
        ? question.answerKey
        : [String(question.answerKey)];

      distractorAnalysis = question.optionsPayload.map((opt: any) => {
        const stats = optionCounts[opt.id] || { high: 0, low: 0, total: 0 };
        const isCorrectChoice = allowedKeys.includes(opt.id);
        const percent = totalStudents > 0
          ? Number(((stats.total / totalStudents) * 100).toFixed(1))
          : 0;

        let assessment = '';
        if (isCorrectChoice) {
          assessment = 'ตัวเลือกที่ถูกต้อง (เฉลย)';
        } else {
          if (stats.total === 0 || percent < 5.0) {
            assessment = 'ตัวลวงไม่มีประสิทธิภาพ (คนเลือกน้อยกว่า 5%)';
          } else if (stats.high > stats.low) {
            assessment = 'ตัวลวงมีข้อบกพร่อง (ลวงกลุ่มเก่งมากกว่ากลุ่มอ่อน)';
          } else {
            assessment = 'ตัวลวงทำงานได้ดี (ลวงกลุ่มอ่อนได้มากกว่ากลุ่มเก่ง)';
          }
        }

        return {
          optionId: opt.id,
          text: opt.text,
          isCorrect: isCorrectChoice,
          highGroupSelected: stats.high,
          lowGroupSelected: stats.low,
          totalSelected: stats.total,
          selectionPercentage: percent,
          assessment,
        };
      });
    }

    results.push({
      questionId: question.id,
      questionNumber: question.questionNumber,
      type: question.type,
      promptText: question.promptText,
      totalStudents,
      highGroupCount: nh,
      lowGroupCount: nl,
      difficultyIndex: p,
      difficultyLabel: interpretDifficulty(p),
      discriminationIndex: r,
      discriminationLabel: interpretDiscrimination(r),
      distractorAnalysis,
    });
  }

  return results;
}
