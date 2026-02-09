import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { SessionService } from '../../lib/session/session-service';

export function IdleTimeoutWarning() {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef<number | null>(null);
  const startCountdownRef = useRef<number>(15);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleStayLoggedIn = useCallback(() => {
    clearCountdown();
    setVisible(false);
    SessionService.dismissIdleWarning();
  }, [clearCountdown]);

  const handleLogoutNow = useCallback(async () => {
    clearCountdown();
    setVisible(false);
    await SessionService.forceLogout();
  }, [clearCountdown]);

  useEffect(() => {
    const onWarning = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const remaining = detail?.remainingSeconds ?? 15;
      startCountdownRef.current = remaining;
      setCountdown(remaining);
      setVisible(true);

      clearCountdown();
      const start = Date.now();
      countdownRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const left = Math.max(0, remaining - elapsed);
        setCountdown(left);
      }, 250);
    };

    const onDismissed = () => {
      clearCountdown();
      setVisible(false);
    };

    const onExpired = () => {
      clearCountdown();
      setVisible(false);
    };

    window.addEventListener('idle-timeout-warning', onWarning);
    window.addEventListener('idle-timeout-dismissed', onDismissed);
    window.addEventListener('idle-timeout-expired', onExpired);

    return () => {
      clearCountdown();
      window.removeEventListener('idle-timeout-warning', onWarning);
      window.removeEventListener('idle-timeout-dismissed', onDismissed);
      window.removeEventListener('idle-timeout-expired', onExpired);
    };
  }, [clearCountdown]);

  if (!visible) return null;

  const progress = startCountdownRef.current > 0
    ? (countdown / startCountdownRef.current) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={handleStayLoggedIn}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden animate-scaleIn">
        <div className="relative h-1.5 bg-slate-100">
          <div
            className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-250 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-8 pt-8 pb-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-5">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Session Expiring Soon
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              You have been inactive. Your session will end automatically
              unless you choose to stay.
            </p>

            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-5xl font-bold tabular-nums text-slate-900">
                {countdown}
              </span>
              <span className="text-lg text-slate-500 font-medium">
                {countdown === 1 ? 'second' : 'seconds'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLogoutNow}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Log Out Now
            </button>
            <button
              onClick={handleStayLoggedIn}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Stay Logged In
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}
