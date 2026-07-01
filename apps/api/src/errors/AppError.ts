export type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  isOperational?: boolean;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown, code = "BAD_REQUEST") {
    super({ statusCode: 400, code, message, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown, code = "UNAUTHORIZED") {
    super({ statusCode: 401, code, message, details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown, code = "FORBIDDEN") {
    super({ statusCode: 403, code, message, details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", details?: unknown, code = "NOT_FOUND") {
    super({ statusCode: 404, code, message, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown, code = "CONFLICT") {
    super({ statusCode: 409, code, message, details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown, code = "VALIDATION_ERROR") {
    super({ statusCode: 400, code, message, details });
  }
}
