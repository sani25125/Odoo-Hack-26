import { DomainError } from '../../errors/domain-error.js';

const decimalPattern = new RegExp('^(0|[1-9][0-9]*)(\\.[0-9]{1,3})?$');

export const validateQuantity = (value, fieldName = 'quantity', allowZero = false) => {
  const text = String(value ?? '');
  const valid = decimalPattern.test(text) && (allowZero || Number(text) > 0);

  if (!valid) {
    throw new DomainError(
      allowZero ? fieldName + ' must be a non-negative quantity with up to 3 decimals' : fieldName + ' must be greater than zero with up to 3 decimals',
      400,
      'VALIDATION_ERROR',
      { [fieldName]: 'Invalid quantity' }
    );
  }

  return text;
};

export const requireLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new DomainError('At least one line is required', 400, 'VALIDATION_ERROR');
  }
  return lines;
};

export const requireText = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError(fieldName + ' is required', 400, 'VALIDATION_ERROR', { [fieldName]: 'Required' });
  }
  return value.trim();
};
