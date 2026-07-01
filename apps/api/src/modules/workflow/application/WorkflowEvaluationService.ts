import type {
  WorkflowCondition,
  WorkflowConditionEvaluationResult,
  WorkflowEvaluationContext,
  WorkflowGuard,
  WorkflowGuardEvaluationResult
} from "../domain/workflow.types.js";

function isPresent(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function simpleEquals(left: unknown, right: string | null | undefined) {
  return String(left) === String(right ?? "");
}

function numericCompare(value: unknown, expectedValue: string | null | undefined, mode: "min" | "max") {
  const actual = Number(value);
  const expected = Number(expectedValue);

  if (Number.isNaN(actual) || Number.isNaN(expected)) {
    return false;
  }

  return mode === "min" ? actual >= expected : actual <= expected;
}

function missingFieldReason(fieldName?: string | null) {
  return fieldName ? `Field ${fieldName} is required for this transition.` : "Field name is required.";
}

export class WorkflowEvaluationService {
  evaluateGuards(
    guards: readonly WorkflowGuard[],
    context: WorkflowEvaluationContext
  ): WorkflowGuardEvaluationResult[] {
    return guards.map((guard) => {
      const value = guard.fieldName ? context.entityData[guard.fieldName] : undefined;
      const reason = guard.errorMessage ?? `Workflow guard ${guard.code} blocked the transition.`;

      switch (guard.guardType) {
        case "REQUIRED_FIELD":
          return { guard, passed: isPresent(value), reason: isPresent(value) ? undefined : missingFieldReason(guard.fieldName) };
        case "ENTITY_PROPERTY_EQUALS":
          return { guard, passed: simpleEquals(value, guard.expectedValue), reason };
        case "ENTITY_PROPERTY_NOT_EQUALS":
          return { guard, passed: !simpleEquals(value, guard.expectedValue), reason };
        case "ENTITY_PROPERTY_MIN":
          return { guard, passed: numericCompare(value, guard.expectedValue, "min"), reason };
        case "ENTITY_PROPERTY_MAX":
          return { guard, passed: numericCompare(value, guard.expectedValue, "max"), reason };
        case "CUSTOM_PLACEHOLDER":
          return {
            guard,
            passed: false,
            reason: guard.errorMessage ?? "Custom workflow guards are placeholders and are blocked safely."
          };
      }
    });
  }

  evaluateConditions(
    conditions: readonly WorkflowCondition[],
    context: WorkflowEvaluationContext
  ): WorkflowConditionEvaluationResult[] {
    return conditions.map((condition) => {
      const value = condition.fieldName ? context.entityData[condition.fieldName] : undefined;
      const reason = `Workflow condition ${condition.code} blocked the transition.`;

      switch (condition.conditionType) {
        case "FIELD_EXISTS":
          return {
            condition,
            passed: isPresent(value),
            reason: isPresent(value) ? undefined : missingFieldReason(condition.fieldName)
          };
        case "FIELD_EQUALS":
          return { condition, passed: simpleEquals(value, condition.expectedValue), reason };
        case "FIELD_NOT_EQUALS":
          return { condition, passed: !simpleEquals(value, condition.expectedValue), reason };
        case "FIELD_GREATER_THAN":
          return { condition, passed: numericCompare(value, condition.expectedValue, "min"), reason };
        case "FIELD_LESS_THAN":
          return { condition, passed: numericCompare(value, condition.expectedValue, "max"), reason };
        case "CUSTOM_PLACEHOLDER":
          return {
            condition,
            passed: false,
            reason: "Custom workflow conditions are placeholders and are blocked safely."
          };
      }
    });
  }
}

export const workflowEvaluationService = new WorkflowEvaluationService();
