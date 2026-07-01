import type { RuntimeFormField } from "../types/runtime-ui.types.js";

export type RuntimeFormValues = Record<string, string | number | boolean | null | undefined>;
export type RuntimeFormErrors = Record<string, string>;

export function initialValuesFromFields(fields: RuntimeFormField[]): RuntimeFormValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.field,
      field.defaultValue ?? (field.inputType === "boolean" ? false : "")
    ])
  );
}

export function validateRuntimeValues(
  fields: RuntimeFormField[],
  values: RuntimeFormValues
): RuntimeFormErrors {
  const errors: RuntimeFormErrors = {};

  fields.forEach((field) => {
    const validation = field.validation;
    const value = values[field.field];
    const empty = value === undefined || value === null || value === "";

    if ((field.required || validation.required) && empty) {
      errors[field.field] = `${field.label} is required.`;
      return;
    }

    if (empty && validation.nullable !== false) {
      return;
    }

    if (typeof value === "string") {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        errors[field.field] = `${field.label} must have at least ${validation.minLength} characters.`;
      }

      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors[field.field] = `${field.label} must have ${validation.maxLength} characters or fewer.`;
      }

      if (validation.regex && !new RegExp(validation.regex).test(value)) {
        errors[field.field] = `${field.label} has an invalid format.`;
      }
    }

    if (typeof value === "number") {
      if (validation.min !== undefined && value < validation.min) {
        errors[field.field] = `${field.label} must be greater than or equal to ${validation.min}.`;
      }

      if (validation.max !== undefined && value > validation.max) {
        errors[field.field] = `${field.label} must be less than or equal to ${validation.max}.`;
      }
    }
  });

  return errors;
}
