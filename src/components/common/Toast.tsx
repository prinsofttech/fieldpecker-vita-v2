import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const config: Record<ToastType, {
  icon: typeof CheckCircle;
  bg: string;
  accent: string;
  iconColor: string;
  titleColor: string;
  messageColor: string;
  closeHover: string;
  progressColor: string;
}> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-white',
    accent: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
    titleColor: 'text-slate-900',
    messageColor: 'text-slate-500',
    closeHover: 'hover:bg-slate-100',
    progressColor: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white',
    accent: 'border-l-red-500',
    iconColor: 'text-red-500',
    titleColor: 'text-slate-900',
    messageColor: 'text-slate-500',
    closeHover: 'hover:bg-slate-100',
    progressColor: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-white',
    accent: 'border-l-amber-500',
    iconColor: 'text-amber-500',
    titleColor: 'text-slate-900',
    messageColor: 'text-slate-500',
    closeHover: 'hover:bg-slate-100',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    accent: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    titleColor: 'text-slate-900',
    messageColor: 'text-slate-500',
    closeHover: 'hover:bg-slate-100',
    progressColor: 'bg-blue-500',
  },
};

export function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 280);
  };

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration]);

  const { icon: Icon, bg, accent, iconColor, titleColor, messageColor, closeHover, progressColor } = config[type];

  return (
    <div
      className={`
        relative overflow-hidden
        flex items-start gap-3 p-4 pr-3
        ${bg} border border-slate-200/80 border-l-4 ${accent}
        rounded-lg
        shadow-[0_8px_30px_rgb(0,0,0,0.08),0_2px_8px_rgb(0,0,0,0.06)]
        ${isExiting ? 'toast-exit' : 'toast-enter'}
      `}
      style={{ minWidth: '340px', maxWidth: '440px' }}
      role="alert"
    >
      <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
        <Icon className="w-5 h-5" strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <p className={`font-semibold text-sm leading-5 ${titleColor}`}>{title}</p>
        {message && (
          <p className={`text-[13px] mt-0.5 leading-5 ${messageColor}`}>{message}</p>
        )}
      </div>

      <button
        onClick={handleClose}
        className={`flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-600 ${closeHover} transition-all duration-150`}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
          <div
            className={`h-full ${progressColor} opacity-60 rounded-full`}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
