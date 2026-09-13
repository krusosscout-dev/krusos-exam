import { NextRequest, NextResponse } from 'next/server';
import { gradeStudentSubmission, validateSessionDeadline } from '@/services/gradingEngine';
import { QuestionDefinition, StudentAnswerPayload } from '@/types/exam';

// Mock DB client representation or Prisma instance
// import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { accessCode: string } }
) {
  try {
    const body = await req.json();
    const { sessionId, answers, isForcedSubmission } = body as {
      sessionId: string;
      answers: StudentAnswerPayload[];
      isForcedSubmission?: boolean;
    };

    if (!sessionId || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'INVALID_SUBMISSION_PAYLOAD' },
        { status: 400 }
      );
    }

    /*
    -----------------------------------------------------------------
    1. Fetch Session and Associated Exam Questions from Database
    -----------------------------------------------------------------
    const session = await prisma.studentSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }

    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'SESSION_ALREADY_COMPLETED_OR_TERMINATED' },
        { status: 400 }
      );
    }
    */

    // Sample session data for demonstration:
    const mockSession = {
      id: sessionId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10), // mock
      status: 'IN_PROGRESS',
      maxViolations: 3,
    };

    // 2. Validate Server Countdown Deadline (Reject if client modified time)
    const { isValid, lateSeconds } = validateSessionDeadline(mockSession.expiresAt, 30);
    if (!isValid && !isForcedSubmission) {
      // Mark as TIMED_OUT
      return NextResponse.json(
        {
          error: 'SUBMISSION_DEADLINE_EXCEEDED',
          message: `หมดเวลาทำข้อสอบแล้ว (ส่งช้าเกินกำหนด ${lateSeconds} วินาที)`,
        },
        { status: 403 }
      );
    }

    // Sample questions with secret answer keys (retrieved from server DB)
    const mockQuestions: QuestionDefinition[] = [
      {
        id: 'q1',
        examId: 'ex-001',
        questionNumber: 1,
        type: 'MULTIPLE_CHOICE',
        promptText: 'หน่วยการทำงานที่เล็กที่สุดของสิ่งมีชีวิตคือข้อใด?',
        points: 1.0,
        answerKey: 'c2',
      },
      {
        id: 'q2',
        examId: 'ex-001',
        questionNumber: 2,
        type: 'TRUE_FALSE',
        promptText: 'พืชสังเคราะห์ด้วยแสงในเวลากลางคืนโดยไม่ใช้แสงสว่าง',
        points: 1.0,
        answerKey: 'false',
      },
      {
        id: 'q3',
        examId: 'ex-001',
        questionNumber: 3,
        type: 'ESSAY',
        promptText: 'จงอธิบายวัฏจักรของน้ำ (Water Cycle) และความสำคัญต่อระบบนิเวศ',
        points: 5.0,
        answerKey: null, // Rubric
      },
    ];

    // 3. Run Grading Engine Logic
    const gradingSummary = gradeStudentSubmission(
      mockSession.id,
      mockQuestions,
      answers,
      isForcedSubmission
    );

    /*
    -----------------------------------------------------------------
    4. Database Transaction: Save Student Answers & Update Session Status
    -----------------------------------------------------------------
    await prisma.$transaction(async (tx) => {
      // A. Save or update answers
      for (const res of gradingSummary.questionResults) {
        const studentAns = answers.find((a) => a.questionId === res.questionId);
        await tx.studentAnswer.upsert({
          where: {
            sessionId_questionId: {
              sessionId: mockSession.id,
              questionId: res.questionId,
            },
          },
          update: {
            responsePayload: studentAns?.response ?? null,
            isAutoGraded: res.isAutoGraded,
            scoreAwarded: res.scoreAwarded,
            isReviewed: res.isAutoGraded,
          },
          create: {
            sessionId: mockSession.id,
            questionId: res.questionId,
            responsePayload: studentAns?.response ?? null,
            isAutoGraded: res.isAutoGraded,
            scoreAwarded: res.scoreAwarded,
            isReviewed: res.isAutoGraded,
          },
        });
      }

      // B. Update StudentSession status and score
      await tx.studentSession.update({
        where: { id: mockSession.id },
        data: {
          submittedAt: new Date(),
          status: gradingSummary.status,
          autoGradedScore: gradingSummary.autoGradedScore,
          manualGradedScore: 0,
          totalScore: gradingSummary.totalScore,
        },
      });
    });
    */

    return NextResponse.json({
      success: true,
      data: {
        sessionId: gradingSummary.sessionId,
        status: gradingSummary.status,
        autoGradedScore: gradingSummary.autoGradedScore,
        allAutoGraded: gradingSummary.allAutoGraded,
        message: gradingSummary.allAutoGraded
          ? 'ส่งข้อสอบและตรวจคะแนนเรียบร้อยแล้ว'
          : 'ส่งข้อสอบเรียบร้อยแล้ว (มีข้อเขียนรอคุณครูตรวจ)',
      },
    });
  } catch (error) {
    console.error('Submission API Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการประมวลผลการส่งข้อสอบ' },
      { status: 500 }
    );
  }
}
