import React, { useState } from 'react';

interface ClassroomOption {
  id: string;
  gradeLevel: string;
  roomNumber: string;
}

interface ExamGatewayProps {
  accessCode: string;
  examTitle: string;
  subjectCode: string;
  subjectName: string;
  durationMinutes: number;
  classrooms: ClassroomOption[];
  onStartExam: (studentData: {
    studentName: string;
    studentIdCard?: string;
    seatNumber: string;
    classroomId: string;
  }) => Promise<{ success: boolean; errorMessage?: string }>;
}

export const ExamGateway: React.FC<ExamGatewayProps> = ({
  accessCode,
  examTitle,
  subjectCode,
  subjectName,
  durationMinutes,
  classrooms,
  onStartExam,
}) => {
  const [studentName, setStudentName] = useState('');
  const [studentIdCard, setStudentIdCard] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [classroomId, setClassroomId] = useState(classrooms[0]?.gradeLevel?.replace(/\/.*$/, '') || classrooms[0]?.id || '');
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!studentName.trim()) {
      setErrorMessage('กรุณาระบุชื่อ - นามสกุลของผู้เข้าสอบ');
      return;
    }
    if (!classroomId) {
      setErrorMessage('กรุณาเลือกระดับชั้น');
      return;
    }
    if (!agreedToRules) {
      setErrorMessage('กรุณาติ๊กยอมรับกฎระเบียบและข้อกำหนดการสอบ');
      return;
    }

    setLoading(true);
    const result = await onStartExam({
      studentName: studentName.trim(),
      studentIdCard: studentIdCard.trim() || '-',
      seatNumber: seatNumber.trim(),
      classroomId,
    });
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage || 'ไม่สามารถเข้าสอบได้ กรุณาตรวจสอบข้อมูล');
    }
  };

  return (
    <div className="w-full flex flex-col justify-center items-center py-2">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl space-y-4 sm:space-y-6">
        {/* Header with Logo */}
        <div className="text-center space-y-2 border-b border-slate-800 pb-4 sm:pb-6">
          <img
            src="/logo.png"
            alt="โลโก้ระบบสอบออนไลน์"
            className="w-14 h-14 sm:w-20 sm:h-20 mx-auto object-contain drop-shadow-md mb-2"
          />
          <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
            ระบบจัดสอบออนไลน์วัดผลมาตรฐาน
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">{examTitle}</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            รหัสวิชา <span className="text-slate-200 font-medium">{subjectCode}</span>: {subjectName}
          </p>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg">
            ⏱️ เวลาในการทำข้อสอบ: {durationMinutes} นาที
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-200 text-sm flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Student Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ชื่อ - นามสกุล <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น ด.ช. สมชาย รักเรียน"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition text-sm placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ระดับชั้น <span className="text-emerald-400">*</span>
              </label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="w-full px-3 py-2.5 sm:py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition text-sm"
              >
                {classrooms.map((c) => {
                  const displayGrade = (c.gradeLevel || c.id).replace(/\/.*$/, '');
                  return (
                    <option key={c.id} value={displayGrade}>
                      {displayGrade}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                เลขที่ (ถ้ามี)
              </label>
              <input
                type="text"
                placeholder="เช่น 12"
                value={seatNumber}
                onChange={(e) => setSeatNumber(e.target.value)}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition text-sm placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                เลขประจำตัวนักเรียน
              </label>
              <span className="text-[11px] text-slate-400 font-normal">
                (ไม่บังคับ - เว้นว่างได้หากจำไม่ได้)
              </span>
            </div>
            <input
              type="text"
              placeholder="เว้นว่างได้ หรือระบุเช่น 54321"
              value={studentIdCard}
              onChange={(e) => setStudentIdCard(e.target.value)}
              className="w-full px-3.5 sm:px-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white outline-none focus:border-emerald-500 transition text-sm placeholder:text-slate-500"
            />
          </div>

          {/* Rules Checkbox */}
          <div className="pt-1 sm:pt-2">
            <label className="flex items-start gap-2.5 sm:gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToRules}
                onChange={(e) => setAgreedToRules(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-emerald-500 shrink-0"
              />
              <span className="text-xs text-slate-400 leading-relaxed">
                ข้าพเจ้ายินยอมเข้าสู่ระบบสอบออนไลน์ในโหมดเต็มหน้าจอ และรับทราบว่าระบบมีการตรวจจับการสลับแท็บ การออกจากจอ และไม่อนุญาตให้คัดลอกข้อความ
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition duration-200 shadow-lg shadow-emerald-700/30 disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2 active:scale-95"
          >
            <span>{loading ? 'กำลังตรวจสอบข้อมูล...' : 'เริ่มทำข้อสอบทันที'}</span>
            <span>🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
};
