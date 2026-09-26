export class DomainError extends Error {
  constructor(message, statusCode = 409, code = 'CONFLICT', fieldErrors) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
