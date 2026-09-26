import { DomainError } from '../errors/domain-error.js';

export const requireAuth = (req, res, next) => {
  if (!req.user?.id) {
    return next(new DomainError('Authentication is required', 401, 'UNAUTHORIZED'));
  }
  return next();
};
