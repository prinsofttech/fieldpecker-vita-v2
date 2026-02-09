import { CheckCircle, X } from 'lucide-react';
import { useEffect } from 'react';

interface SuccessNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  duration?: number;
}

export function SuccessNotification({
  isOpen,
  onClose,
  message,
  duration = 3000
}: SuccessNotificationProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 duration-300">
      <div className="bg-white rounded-xl shadow-2xl border border-green-200 max-w-md overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 mb-0.5">Success</p>
            <p className="text-sm text-slate-600">{message}</p>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="h-1 bg-green-100">
          <div
            className="h-full bg-green-500 animate-shrink-width"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
