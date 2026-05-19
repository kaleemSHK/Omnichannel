export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const err = {
  notFound:   (what)  => new AppError('NOT_FOUND',       `${what} not found`, 404),
  conflict:   (what)  => new AppError('CONFLICT',        `${what} already exists`, 409),
  validation: (msg)   => new AppError('VALIDATION_ERROR', msg, 400),
  badState:   (msg)   => new AppError('BAD_STATE',        msg, 422),
  unauth:     ()      => new AppError('UNAUTHORIZED',    'Unauthorized', 401),
};
