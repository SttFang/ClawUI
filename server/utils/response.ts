import { randomUUID } from 'crypto';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly statusCode: number = 400
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function success<T>(data: T) {
  return {
    requestId: randomUUID(),
    data,
  };
}

export function error(err: ApiError) {
  return {
    requestId: randomUUID(),
    error: {
      code: err.code,
      message: err.messageKey,
    },
  };
}

export const Errors = {
  Unauthorized: () => new ApiError('Unauthorized', 'common:errors.unauthorized', 401),
  Forbidden: () => new ApiError('Forbidden', 'common:errors.forbidden', 403),
  NotFound: () => new ApiError('NotFound', 'common:errors.notFound', 404),
  BadRequest: (message = 'common:errors.badRequest') =>
    new ApiError('BadRequest', message, 400),
  InternalError: () =>
    new ApiError('InternalError', 'common:errors.internal', 500),
};
