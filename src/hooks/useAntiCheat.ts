import { useEffect, useState, useCallback, useRef } from 'react';
import { ViolationType } from '../types/exam';

interface UseAntiCheatOptions {
  sessionId: string;
  maxViolations: number;
  initialViolations?: number;
  expiresAt: string | Date; // Server-authoritative expiration timestamp
  onViolationThresholdReached: () => void;
  onTimeExpired: () => void;
  onViolationLogged?: (type: ViolationType, description: string) => void;
  enableAntiCheat?: boolean;
}

export function useAntiCheat({
  sessionId,
  maxViolations,
  initialViolations = 0,
  expiresAt,
  onViolationThresholdReached,
  onTimeExpired,
  onViolationLogged,
  enableAntiCheat = true,
}: UseAntiCheatOptions) {
  const [violations, setViolations] = useState<number>(initialViolations);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [lastViolationMsg, setLastViolationMsg] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const isTerminatedRef = useRef<boolean>(false);
  const thresholdReachedRef = useRef(onViolationThresholdReached);
  thresholdReachedRef.current = onViolationThresholdReached;

  const timeExpiredRef = useRef(onTimeExpired);
  timeExpiredRef.current = onTimeExpired;

  // -------------------------------------------------------------
  // 1. Server Countdown Timer (ป้องกันการปรับเวลาเครื่อง)
  // -------------------------------------------------------------
  useEffect(() => {
    const calculateRemaining = () => {
      const targetTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((targetTime - now) / 1000));
      return diffSec;
    };

    setRemainingSeconds(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !isTerminatedRef.current) {
        isTerminatedRef.current = true;
        clearInterval(interval);
        timeExpiredRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // -------------------------------------------------------------
  // 2. Report Violation to Backend
  // -------------------------------------------------------------
  const reportViolation = useCallback(
    async (type: ViolationType, description: string) => {
      if (!enableAntiCheat || isTerminatedRef.current) return;

      setViolations((prev) => {
        const nextCount = prev + 1;
        setLastViolationMsg(description);
        setShowWarningModal(true);

        if (nextCount >= maxViolations && !isTerminatedRef.current) {
          isTerminatedRef.current = true;
          thresholdReachedRef.current();
        }
        return nextCount;
      });

      if (onViolationLogged) {
        onViolationLogged(type, description);
      }

      // ส่ง Log แบบ Asynchronous ไปที่เซิร์ฟเวอร์
      try {
        await fetch('/api/exam/violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            type,
            description,
            occurredAt: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error('Failed to log violation to server:', err);
      }
    },
    [enableAntiCheat, maxViolations, onViolationLogged, sessionId]
  );

  // -------------------------------------------------------------
  // 3. Forced Fullscreen Handler
  // -------------------------------------------------------------
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen request rejected by browser:', err);
    }
  }, []);

  // -------------------------------------------------------------
  // 4. Anti-Cheat Event Listeners
  // -------------------------------------------------------------
  useEffect(() => {
    if (!enableAntiCheat) return;

    // A. ตรวจจับการสลับแท็บ / ยุบจอ (Page Visibility API)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation('TAB_SWITCH', 'ตรวจพบการสลับหน้าต่างเบราว์เซอร์หรือสลับแท็บ');
      }
    };

    // B. ตรวจจับการคลิกออกนอกหน้าจอ (Window Blur)
    const handleBlur = () => {
      reportViolation('WINDOW_BLUR', 'ตรวจพบการคลิกออกนอกหน้าจอสอบ (Focus Lost)');
    };

    // C. ตรวจจับการหลุดจากโหมดเต็มหน้าจอ (Fullscreen change)
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active && !isTerminatedRef.current) {
        reportViolation('FULLSCREEN_EXIT', 'ตรวจพบการออกจากโหมดเต็มหน้าจอ');
      }
    };

    // D. ป้องกันคลิกขวา (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation('CLIPBOARD_ATTEMPT', 'ไม่อนุญาตให้คลิกขวาในระหว่างการสอบ');
    };

    // E. ป้องกัน Copy / Cut / Paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation('CLIPBOARD_ATTEMPT', 'ไม่อนุญาตให้คัดลอกข้อความ (Copy attempt)');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation('CLIPBOARD_ATTEMPT', 'ไม่อนุญาตให้วางข้อความ (Paste attempt)');
    };

    // F. ตรวจจับคีย์ลัดต้องห้าม (DevTools, PrintScreen, Alt+Tab, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (Inspect Element)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        reportViolation('DEVTOOLS_OPEN', 'ตรวจพบความพยายามเปิด Developer Tools หรือดูซอร์สโค้ด');
        return;
      }

      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        reportViolation('SUSPICIOUS_KEY', 'ตรวจพบความพยายามแคปเจอร์หน้าจอ (PrintScreen)');
        return;
      }

      // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A
      if (e.ctrlKey && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        reportViolation('CLIPBOARD_ATTEMPT', `ตรวจพบการใช้งานคีย์ลัด Ctrl+${e.key.toUpperCase()}`);
        return;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableAntiCheat, reportViolation]);

  const dismissWarningModal = () => {
    setShowWarningModal(false);
    // บังคับกลับเข้าเต็มจออีกครั้ง
    enterFullscreen();
  };

  return {
    violations,
    maxViolations,
    showWarningModal,
    lastViolationMsg,
    isFullscreen,
    remainingSeconds,
    enterFullscreen,
    dismissWarningModal,
  };
}
