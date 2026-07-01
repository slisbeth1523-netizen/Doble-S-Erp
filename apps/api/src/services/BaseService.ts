import { ConflictError, NotFoundError } from "../errors/index.js";

export abstract class BaseService {
  protected ensureFound<TValue>(value: TValue | null | undefined, message = "Resource not found") {
    if (value === null || value === undefined) {
      throw new NotFoundError(message);
    }

    return value;
  }

  protected ensureBusinessRule(condition: boolean, message: string, code = "BUSINESS_RULE_CONFLICT") {
    if (!condition) {
      throw new ConflictError(message, undefined, code);
    }
  }
}
