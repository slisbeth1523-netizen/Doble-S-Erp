import { AppError as CoreAppError } from "../../errors/index.js";

export class AppError extends CoreAppError {
  constructor(
    message: string,
    statusCode = 500,
    code = "APP_ERROR",
    details?: unknown
  ) {
    super({ statusCode, code, message, details });
  }
}
