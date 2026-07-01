import { useEffect, useMemo, useState } from "react";

import { useCatalogMetadata } from "../hooks/useCatalogMetadata.js";
import type { RuntimeFormField } from "../types/runtime-ui.types.js";
import {
  initialValuesFromFields,
  type RuntimeFormValues,
  validateRuntimeValues
} from "../utils/validationRuntime.js";
import { LookupField } from "./LookupField.js";

type DynamicFormProps = {
  catalog: string;
  initialValues?: RuntimeFormValues;
  onSubmit?: (values: RuntimeFormValues) => void;
};

function normalizeInputValue(field: RuntimeFormField, value: string | boolean) {
  if (field.inputType === "number") {
    return value === "" ? "" : Number(value);
  }

  return value;
}

function renderField(
  field: RuntimeFormField,
  value: RuntimeFormValues[string],
  onChange: (field: string, value: RuntimeFormValues[string]) => void
) {
  const disabled = field.readOnly || !field.editable;
  const commonProps = {
    id: field.field,
    disabled,
    placeholder: field.placeholder,
    required: field.required
  };

  if (field.inputType === "textarea") {
    return (
      <textarea
        {...commonProps}
        onChange={(event) => onChange(field.field, event.target.value)}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  if (field.inputType === "boolean") {
    return (
      <input
        checked={Boolean(value)}
        disabled={disabled}
        id={field.field}
        onChange={(event) => onChange(field.field, event.target.checked)}
        type="checkbox"
      />
    );
  }

  if (field.inputType === "lookup") {
    if (!field.lookupCatalog) {
      return (
        <input
          {...commonProps}
          onChange={(event) => onChange(field.field, event.target.value)}
          type="text"
          value={typeof value === "string" ? value : ""}
        />
      );
    }

    return (
      <LookupField
        catalog={field.lookupCatalog}
        disabled={disabled}
        onChange={(nextValue) => onChange(field.field, nextValue)}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : undefined}
      />
    );
  }

  if (field.inputType === "select") {
    return (
      <select
        {...commonProps}
        onChange={(event) => onChange(field.field, event.target.value)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">Select an option</option>
      </select>
    );
  }

  const inputType = field.inputType === "datetime" ? "datetime-local" : field.inputType;

  return (
    <input
      {...commonProps}
      onChange={(event) => onChange(field.field, normalizeInputValue(field, event.target.value))}
      type={inputType}
      value={typeof value === "boolean" ? String(value) : value ?? ""}
    />
  );
}

export function DynamicForm({ catalog, initialValues, onSubmit }: DynamicFormProps) {
  const metadata = useCatalogMetadata(catalog);
  const fields = useMemo(
    () =>
      metadata.data?.form.fields
        .filter((field) => field.editable || !field.readOnly)
        .sort((left, right) => left.order - right.order) ?? [],
    [metadata.data]
  );
  const [values, setValues] = useState<RuntimeFormValues>({});
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => validateRuntimeValues(fields, values), [fields, values]);

  useEffect(() => {
    if (metadata.data) {
      setValues({
        ...initialValuesFromFields(metadata.data.form.fields),
        ...initialValues
      });
    }
  }, [initialValues, metadata.data]);

  if (metadata.loading) {
    return <div className="runtime-state">Loading form...</div>;
  }

  if (metadata.error) {
    return <div className="runtime-state runtime-error">{metadata.error}</div>;
  }

  if (!metadata.data || fields.length === 0) {
    return <div className="runtime-state">No form fields available.</div>;
  }

  return (
    <form
      className="runtime-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);

        if (Object.keys(errors).length === 0) {
          onSubmit?.(values);
        }
      }}
    >
      {fields.map((field) => (
        <label className="runtime-field" key={field.field} htmlFor={field.field}>
          <span>
            {field.label}
            {field.required ? <strong aria-label="required">*</strong> : null}
          </span>
          {renderField(field, values[field.field], (fieldName, value) =>
            setValues((current) => ({ ...current, [fieldName]: value }))
          )}
          {field.helpText ? <small>{field.helpText}</small> : null}
          {submitted && errors[field.field] ? (
            <small className="runtime-error">{errors[field.field]}</small>
          ) : null}
        </label>
      ))}
      <button className="runtime-primary-action" type="submit">
        Save
      </button>
    </form>
  );
}
