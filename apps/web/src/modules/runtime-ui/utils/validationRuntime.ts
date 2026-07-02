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
      errors[field.field] = `${field.label} es requerido.`;
      return;
    }

    if (empty && validation.nullable !== false) {
      return;
    }

    if (typeof value === "string") {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        errors[field.field] = `${field.label} debe tener al menos ${validation.minLength} caracteres.`;
      }

      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors[field.field] = `${field.label} debe tener ${validation.maxLength} caracteres o menos.`;
      }

      if (validation.regex && !new RegExp(validation.regex).test(value)) {
        errors[field.field] = `${field.label} tiene un formato inválido.`;
      }
    }

    if (typeof value === "number") {
      if (validation.min !== undefined && value < validation.min) {
        errors[field.field] = `${field.label} debe ser mayor o igual que ${validation.min}.`;
      }

      if (validation.max !== undefined && value > validation.max) {
        errors[field.field] = `${field.label} debe ser menor o igual que ${validation.max}.`;
      }
    }
  });

  return errors;
}
