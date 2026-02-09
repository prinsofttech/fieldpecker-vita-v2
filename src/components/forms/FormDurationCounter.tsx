import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { FormTrackingService } from '../../lib/forms/form-tracking-service';

interface FormDurationCounterProps {
  className?: string;
  showLabel?: boolean;
}

export function FormDurationCounter({ className = '', showLabel = true }: FormDurationCounterProps) {
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkTracking = () => {
      const tracking = FormTrackingService.isTracking();
      setIsActive(tracking);
      if (tracking) {
        setDuration(FormTrackingService.getCurrentDuration());
      }
    };

    checkTracking();

    const interval = setInterval(() => {
      if (FormTrackingService.isTracking()) {
        setDuration(FormTrackingService.getCurrentDuration());
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isActive) {
    return null;
  }

  const formattedDuration = FormTrackingService.formatDuration(duration);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <Clock className="w-4 h-4 text-emerald-600" />
        {showLabel && (
          <span className="text-xs text-emerald-700 font-medium">Time on form:</span>
        )}
        <span className="text-sm font-bold text-emerald-800 tabular-nums">
          {formattedDuration}
        </span>
      </div>
    </div>
  );
}
