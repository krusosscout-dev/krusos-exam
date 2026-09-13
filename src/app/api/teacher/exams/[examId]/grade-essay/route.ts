import { NextRequest, NextResponse } from 'next/server';

// Mock DB client representation or Prisma instance
// import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const body = await req.json();
    const { answerId, sessionId, scoreAwarded, feedback } = body as {
      answerId: string;
      sessionId: string;
      scoreAwarded: number;
      feedback?: string;
    };

    if (!answerId || !sessionId || scoreAwarded === undefined) {
      return NextResponse.json(
        { error: 'MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      );
    }

    /*
    -----------------------------------------------------------------
    1. Update the StudentAnswer with teacher score and feedback
    2. Recalculate manualGradedScore and totalScore for the session
    3. Check if all essay answers for this session are now reviewed
       If yes, change status to GRADED
    -----------------------------------------------------------------
    const updatedSession = await prisma.$transaction(async (tx) => {
      // A. Update student answer
      await tx.studentAnswer.update({
        where: { id: answerId },
        data: {
          scoreAwarded: Number(scoreAwarded),
          teacherFeedback: feedback || null,
          isReviewed: true,
        },
      });

      // B. Recalculate all answers for this session
      const allAnswers = await tx.studentAnswer.findMany({
        where: { sessionId },
      });

      const autoScore = allAnswers
        .filter((a) => a.isAutoGraded)
        .reduce((sum, a) => sum + a.scoreAwarded, 0);

      const manualScore = allAnswers
        .filter((a) => !a.isAutoGraded)
        .reduce((sum, a) => sum + a.scoreAwarded, 0);

      const hasPendingReview = allAnswers.some((a) => !a.isReviewed);

      return await tx.studentSession.update({
        where: { id: sessionId },
        data: {
          autoGradedScore: autoScore,
          manualGradedScore: manualScore,
          totalScore: autoScore + manualScore,
          status: hasPendingReview ? 'SUBMITTED' : 'GRADED',
        },
      });
    });
    */

    return NextResponse.json({
      success: true,
      data: {
        answerId,
        sessionId,
        scoreAwarded,
        message: 'บันทึกคะแนนตรวจข้อเขียนสำเร็จเรียบร้อย',
      },
    });
  } catch (error) {
    console.error('Grade Essay API Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการบันทึกคะแนน' },
      { status: 500 }
    );
  }
}
