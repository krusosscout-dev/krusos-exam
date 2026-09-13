import React, { useState } from 'react';
import { QuestionDefinition, StudentAnswerPayload } from '../types/exam';
import { useAntiCheat } from '../hooks/useAntiCheat';

interface ExamRoomProps {
  examTitle: string;
  subjectName: string;
  studentName: string;
  studentIdCard: string;
  classroomLabel: string;
  sessionId: string;
  expiresAt: string;
  maxViolations: number;
  questions: QuestionDefinition[];
  onSubmitExam: (answers: StudentAnswerPayload[], isForced: boolean) => Promise<void>;
}

export const ExamRoom: React.FC<ExamRoomProps> = ({
  examTitle,
  subjectName,
  studentName,
  studentIdCard,
  classroomLabel,
  sessionId,
  expiresAt,
  maxViolations,
  questions,
  onSubmitExam,
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);

  const handleForceSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const payload: StudentAnswerPayload[] = questions.map((q) => ({
      questionId: q.id,
      response: answers[q.id] ?? null,
    }));
    await onSubmitExam(payload, true);
  };

  const handleTimeExpired = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const payload: StudentAnswerPayload[] = questions.map((q) => ({
      questionId: q.id,
      response: answers[q.id] ?? null,
    }));
    await onSubmitExam(payload, false);
  };

  const {
    violations,
    showWarningModal,
    lastViolationMsg,
    isFullscreen,
    remainingSeconds,
    enterFullscreen,
    dismissWarningModal,
  } = useAntiCheat({
    sessionId,
    maxViolations,
    expiresAt,
    onViolationThresholdReached: handleForceSubmit,
    onTimeExpired: handleTimeExpired,
  });

  const formatTimer = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return `${hours > 0 ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  };

  const updateAnswer = (questionId: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
  };

  const activeQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
      {/* 1. Header Bar: Info, Countdown & Violation Badge */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">{examTitle}</h1>
          <p className="text-xs text-slate-400">
            วิชา: <span className="text-emerald-400 font-medium">{subjectName}</span> | นร: {studentName} ({studentIdCard}) ห้อง {classroomLabel}
          </p>
        </div>

        <div className="flex items-center space-x-6">
          {/* Violation Indicator */}
          <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-red-500/30">
            <span className="text-xs text-red-400 font-semibold">การทำผิดกฎ:</span>
            <span className={`text-sm font-bold ${violations > 0 ? 'text-red-500' : 'text-slate-300'}`}>
              {violations} / {maxViolations} ครั้ง
            </span>
          </div>

          {/* Server Countdown Timer */}
          <div className={`px-4 py-1.5 rounded-lg font-mono text-base font-bold shadow-inner ${
            remainingSeconds < 300
              ? 'bg-red-950/80 text-red-400 border border-red-600 animate-pulse'
              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-600'
          }`}>
            ⏳ เหลือเวลา: {formatTimer(remainingSeconds)}
          </div>
        </div>
      </header>

      {/* 2. Fullscreen Requirement Blocker */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-800 p-8 rounded-2xl border border-amber-500/50 shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              !
            </div>
            <h2 className="text-2xl font-bold text-white">ต้องการโหมดเต็มหน้าจอ</h2>
            <p className="text-slate-300 text-sm">
              เพื่อความโปร่งใสและปฏิบัติตามกฎการสอบออนไลน์ กรุณากดปุ่มด้านล่างเพื่อเข้าสู่โหมดเต็มหน้าจอทันที
            </p>
            <button
              onClick={enterFullscreen}
              className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-700/40"
            >
              เข้าสู่โหมดเต็มหน้าจอเพื่อทำข้อสอบ
            </button>
          </div>
        </div>
      )}

      {/* 3. Violation Warning Pop-up Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg bg-red-950/90 border-2 border-red-500 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-bounce-short">
            <div className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto text-3xl font-extrabold shadow-lg">
              ⚠️
            </div>
            <h3 className="text-2xl font-black text-red-100">ตรวจพบการละเมิดกฎการสอบ!</h3>
            <p className="text-red-200 text-base font-medium">{lastViolationMsg}</p>
            <div className="bg-red-900/50 p-3 rounded-xl border border-red-700 text-sm text-red-300">
              คุณทำผิดกฎไปแล้ว <strong className="text-white text-base">{violations}</strong> จากสิทธิ์สูงสุด{' '}
              <strong className="text-white text-base">{maxViolations}</strong> ครั้ง
              {violations >= maxViolations ? (
                <p className="text-white font-bold mt-1 text-sm underline">
                  ระบบกำลังบังคับส่งข้อสอบของคุณทันที!
                </p>
              ) : (
                <p className="mt-1">หากครบ {maxViolations} ครั้ง ระบบจะระงับการสอบและส่งข้อสอบโดยอัตโนมัติ</p>
              )}
            </div>
            {violations < maxViolations && (
              <button
                onClick={dismissWarningModal}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition shadow-lg shadow-red-900/50"
              >
                รับทราบและกลับเข้าสู่การสอบ
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Main Body: Question Area & Navigation Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left/Main Column: Question Card */}
        <section className="lg:col-span-3 bg-slate-800/80 border border-slate-700 rounded-2xl p-8 flex flex-col justify-between shadow-xl">
          {activeQuestion && (
            <div className="space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <span className="bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-lg text-sm">
                  ข้อที่ {currentQuestionIndex + 1} จาก {questions.length}
                </span>
                <span className="text-slate-400 text-sm">
                  คะแนนเต็ม: <strong className="text-white">{activeQuestion.points}</strong> คะแนน
                </span>
              </div>

              {/* Question Prompt */}
              <div className="text-lg text-slate-100 font-medium leading-relaxed">
                {activeQuestion.promptText}
              </div>

              {/* Media if present */}
              {activeQuestion.mediaUrl && (
                <div className="my-4 rounded-xl overflow-hidden max-w-md border border-slate-700">
                  <img src={activeQuestion.mediaUrl} alt="ประกอบคำถาม" className="w-full object-cover" />
                </div>
              )}

              {/* Input Types */}
              <div className="pt-2">
                {/* A. MULTIPLE CHOICE */}
                {activeQuestion.type === 'MULTIPLE_CHOICE' && Array.isArray(activeQuestion.optionsPayload) && (
                  <div className="space-y-3">
                    {activeQuestion.optionsPayload.map((opt: any) => {
                      const isSelected = answers[activeQuestion.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => updateAnswer(activeQuestion.id, opt.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center space-x-4 ${
                            isSelected
                              ? 'bg-emerald-600/30 border-emerald-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-700 hover:border-slate-500 text-slate-200'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isSelected ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-slate-500'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                          <span className="text-base">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* B. TRUE / FALSE */}
                {activeQuestion.type === 'TRUE_FALSE' && (
                  <div className="grid grid-cols-2 gap-4">
                    {['true', 'false'].map((val) => {
                      const isSelected = answers[activeQuestion.id] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => updateAnswer(activeQuestion.id, val)}
                          className={`py-4 rounded-xl border font-bold text-center transition-all ${
                            isSelected
                              ? 'bg-emerald-600/40 border-emerald-500 text-white shadow-lg'
                              : 'bg-slate-900/60 border-slate-700 hover:border-slate-500 text-slate-300'
                          }`}
                        >
                          {val === 'true' ? ' ถูกต้อง (True)' : ' ผิด (False)'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* C. FILL IN THE BLANK */}
                {activeQuestion.type === 'FILL_IN_BLANK' && (
                  <div>
                    <input
                      type="text"
                      placeholder="พิมพ์คำตอบของคุณที่นี่..."
                      value={answers[activeQuestion.id] || ''}
                      onChange={(e) => updateAnswer(activeQuestion.id, e.target.value)}
                      className="w-full p-4 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white text-base outline-none"
                    />
                  </div>
                )}

                {/* D. ESSAY */}
                {activeQuestion.type === 'ESSAY' && (
                  <div>
                    <textarea
                      rows={6}
                      placeholder="พิมพ์คำตอบบรรยาย/อัตนัยของคุณอย่างละเอียด..."
                      value={answers[activeQuestion.id] || ''}
                      onChange={(e) => updateAnswer(activeQuestion.id, e.target.value)}
                      className="w-full p-4 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white text-base outline-none resize-y"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      * ข้อสอบข้อนี้เป็นข้อเขียนอัตนัย คุณครูผู้สอนจะเป็นผู้ตรวจให้คะแนนหลังส่งข้อสอบ
                    </p>
                  </div>
                )}

                {/* E. MATCHING */}
                {activeQuestion.type === 'MATCHING' && activeQuestion.optionsPayload && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">เลือกจับคู่รายการทางซ้ายมือให้ตรงกับตัวเลือกทางขวามือ:</p>
                    {activeQuestion.optionsPayload.left.map((itemLeft: any) => {
                      const currentMatch = answers[activeQuestion.id]?.[itemLeft.id] || '';
                      return (
                        <div key={itemLeft.id} className="flex items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-700">
                          <span className="text-slate-200 font-medium text-sm w-1/2">{itemLeft.text}</span>
                          <select
                            value={currentMatch}
                            onChange={(e) => {
                              const existingMatches = answers[activeQuestion.id] || {};
                              updateAnswer(activeQuestion.id, {
                                ...existingMatches,
                                [itemLeft.id]: e.target.value,
                              });
                            }}
                            className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white w-1/2 outline-none focus:border-emerald-500"
                          >
                            <option value="">-- เลือกคู่ที่ถูกต้อง --</option>
                            {activeQuestion.optionsPayload.right.map((itemRight: any) => (
                              <option key={itemRight.id} value={itemRight.id}>
                                {itemRight.text}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-slate-700 pt-6 mt-8">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← ข้อก่อนหน้า
            </button>

            {isLastQuestion ? (
              <button
                onClick={() => setShowConfirmSubmit(true)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-700/40"
              >
                ตรวจทานและส่งข้อสอบ ✨
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
              >
                ข้อถัดไป →
              </button>
            )}
          </div>
        </section>

        {/* Right Column: Question Navigator Palette */}
        <aside className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2">ผังข้อสอบ</h2>
            <p className="text-xs text-slate-400 mb-4">
              ตอบแล้ว <span className="text-emerald-400 font-bold">{answeredCount}</span> จาก {questions.length} ข้อ
            </p>

            <div className="grid grid-cols-5 gap-2.5 max-h-96 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const hasAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                const isCurrent = idx === currentQuestionIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-bold transition flex items-center justify-center border ${
                      isCurrent
                        ? 'border-blue-400 bg-blue-600 text-white shadow-md'
                        : hasAnswered
                        ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-700">
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-lg"
            >
              ส่งคำตอบ ({answeredCount}/{questions.length})
            </button>
          </div>
        </aside>
      </main>

      {/* Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">ยืนยันการส่งข้อสอบ</h3>
            <p className="text-slate-300 text-sm">
              คุณตอบข้อสอบไปแล้ว{' '}
              <strong className="text-emerald-400">{answeredCount}</strong> จาก{' '}
              <strong className="text-white">{questions.length}</strong> ข้อ
              {answeredCount < questions.length && (
                <span className="block text-amber-400 font-semibold mt-1">
                  * ยังมีข้อที่ยังไม่ได้ตอบอีก {questions.length - answeredCount} ข้อ!
                </span>
              )}
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-medium transition"
              >
                กลับไปทำต่อ
              </button>
              <button
                disabled={isSubmitting}
                onClick={async () => {
                  setIsSubmitting(true);
                  const payload: StudentAnswerPayload[] = questions.map((q) => ({
                    questionId: q.id,
                    response: answers[q.id] ?? null,
                  }));
                  await onSubmitExam(payload, false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg"
              >
                {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งข้อสอบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
