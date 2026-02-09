import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

export type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'month' | 'last_month' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}

interface DateRangeSelectorProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  label?: string;
  className?: string;
}

export function DateRangeSelector({ value, onChange, label, className = '' }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInputs, setShowCustomInputs] = useState(value.preset === 'custom');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presetOptions = [
    { value: 'today' as DateRangePreset, label: 'Today' },
    { value: 'yesterday' as DateRangePreset, label: 'Yesterday' },
    { value: 'last7days' as DateRangePreset, label: 'Last 7 Days' },
    { value: 'month' as DateRangePreset, label: 'This Month' },
    { value: 'last_month' as DateRangePreset, label: 'Last Month' },
    { value: 'custom' as DateRangePreset, label: 'Custom Range' },
  ];

  const getDateRangeForPreset = (preset: DateRangePreset): { startDate: string; endDate: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today': {
        const todayStr = today.toISOString().split('T')[0];
        return { startDate: todayStr, endDate: todayStr };
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return { startDate: yesterdayStr, endDate: yesterdayStr };
      }
      case 'last7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          startDate: sevenDaysAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        };
      }
      case 'month': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: firstDay.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        };
      }
      case 'last_month': {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: firstDayLastMonth.toISOString().split('T')[0],
          endDate: lastDayLastMonth.toISOString().split('T')[0],
        };
      }
      case 'custom':
      default:
        return { startDate: value.startDate, endDate: value.endDate };
    }
  };

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustomInputs(true);
      const dates = value.preset === 'custom'
        ? { startDate: value.startDate, endDate: value.endDate }
        : getDateRangeForPreset('last7days');
      onChange({ preset, ...dates });
    } else {
      setShowCustomInputs(false);
      const dates = getDateRangeForPreset(preset);
      onChange({ preset, ...dates });
      setIsOpen(false);
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', dateValue: string) => {
    onChange({
      preset: 'custom',
      startDate: field === 'startDate' ? dateValue : value.startDate,
      endDate: field === 'endDate' ? dateValue : value.endDate,
    });
  };

  const getDisplayText = () => {
    const option = presetOptions.find(opt => opt.value === value.preset);
    if (value.preset === 'custom' && value.startDate && value.endDate) {
      const start = new Date(value.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = new Date(value.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    }
    return option?.label || 'Select Range';
  };

  return (
    <div className={`flex flex-col ${className}`} ref={dropdownRef}>
      {label && (
        <label className="text-xs font-medium text-slate-600 mb-1 px-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 min-w-[180px]"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{getDisplayText()}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[240px] overflow-hidden">
            <div className="p-2">
              {presetOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetSelect(option.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    value.preset === option.value
                      ? 'bg-[#015324] text-white font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {showCustomInputs && value.preset === 'custom' && (
              <div className="border-t border-slate-200 p-3 bg-slate-50">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={value.startDate}
                      onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={value.endDate}
                      onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full px-3 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const getInitialDateRange = (preset: DateRangePreset = 'today'): DateRangeValue => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today': {
      const todayStr = today.toISOString().split('T')[0];
      return { preset, startDate: todayStr, endDate: todayStr };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { preset, startDate: yesterdayStr, endDate: yesterdayStr };
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        preset,
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        preset,
        startDate: firstDay.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    case 'last_month': {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        preset,
        startDate: firstDayLastMonth.toISOString().split('T')[0],
        endDate: lastDayLastMonth.toISOString().split('T')[0],
      };
    }
    case 'custom':
    default: {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        preset: 'custom',
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
  }
};
