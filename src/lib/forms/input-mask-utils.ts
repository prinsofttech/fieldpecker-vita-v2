import type { InputMask } from './types';

const MASK_FILTERS: Record<string, RegExp> = {
  numeric: /[^0-9]/g,
  alpha: /[^a-zA-Z\s]/g,
  alphanumeric: /[^a-zA-Z0-9\s]/g,
};

export function applyPhoneFormat(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function applyCurrencyFormat(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts[1] !== undefined) {
    return parts[0] + '.' + parts[1].slice(0, 2);
  }
  return cleaned;
}

export function applyCustomFormat(raw: string, format: string): string {
  const digits = raw.replace(/[^a-zA-Z0-9]/g, '');
  let result = '';
  let digitIndex = 0;

  for (let i = 0; i < format.length && digitIndex < digits.length; i++) {
    const ch = format[i];
    if (ch === '#') {
      result += digits[digitIndex++];
    } else if (ch === 'A') {
      if (/[a-zA-Z]/.test(digits[digitIndex])) {
        result += digits[digitIndex++];
      } else {
        digitIndex++;
        i--;
      }
    } else {
      result += ch;
    }
  }

  return result;
}

export function applyInputMask(value: string, mask: InputMask | undefined): string {
  if (!mask || mask.type === 'none') return value;

  let result = value;

  switch (mask.type) {
    case 'phone':
      result = applyPhoneFormat(value);
      break;

    case 'numeric':
      result = value.replace(MASK_FILTERS.numeric, '');
      break;

    case 'alpha':
      result = value.replace(MASK_FILTERS.alpha, '');
      break;

    case 'alphanumeric':
      result = value.replace(MASK_FILTERS.alphanumeric, '');
      break;

    case 'currency':
      result = applyCurrencyFormat(value);
      break;

    case 'custom':
      if (mask.customPattern) {
        try {
          const regex = new RegExp(mask.customPattern);
          if (!regex.test(value) && value.length > 0) {
            result = value.slice(0, -1);
          } else {
            result = value;
          }
        } catch {
          result = value;
        }
      }
      if (mask.format) {
        result = applyCustomFormat(value, mask.format);
      }
      break;
  }

  if (mask.maxLength && result.length > mask.maxLength) {
    result = result.slice(0, mask.maxLength);
  }

  return result;
}

export function getMaskPlaceholder(mask: InputMask | undefined): string | undefined {
  if (!mask || mask.type === 'none') return undefined;

  switch (mask.type) {
    case 'phone': return '(555) 123-4567';
    case 'numeric': return 'Numbers only';
    case 'alpha': return 'Letters only';
    case 'alphanumeric': return 'Letters and numbers only';
    case 'currency': return '0.00';
    case 'custom':
      if (mask.format) return mask.format.replace(/#/g, '_');
      return undefined;
    default: return undefined;
  }
}

export const INPUT_MASK_PRESETS: { value: string; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No restrictions' },
  { value: 'phone', label: 'Phone Number', description: 'Format: (###) ###-####' },
  { value: 'numeric', label: 'Numbers Only', description: 'Only digits 0-9' },
  { value: 'alpha', label: 'Letters Only', description: 'Only alphabetic characters' },
  { value: 'alphanumeric', label: 'Letters & Numbers', description: 'No special characters' },
  { value: 'currency', label: 'Currency', description: 'Decimal number with 2 places' },
  { value: 'custom', label: 'Custom Pattern', description: 'Define your own rules' },
];
