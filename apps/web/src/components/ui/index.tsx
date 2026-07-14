import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`.trim()} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`.trim()} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ui-input ${className}`.trim()} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input ui-textarea ${className}`.trim()} {...props} />;
}

export function Checkbox({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-checkbox ${className}`.trim()} type="checkbox" {...props} />;
}

export function Card({ children, className = "", ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`.trim()} {...props}>{children}</section>;
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Table({
  columns,
  rows,
  emptyText = "No hay datos para mostrar."
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  emptyText?: string;
}) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({
  title,
  children,
  open,
  onClose
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-modal-backdrop" role="presentation">
      <section aria-modal="true" className="ui-modal" role="dialog">
        <header className="ui-modal-header">
          <h2>{title}</h2>
          <Button aria-label="Cerrar" onClick={onClose} type="button" variant="ghost">
            x
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Alert({
  children,
  tone = "info",
  title
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
}) {
  return (
    <div className={`ui-alert ui-alert-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      <span>{children}</span>
    </div>
  );
}

export function Toast({
  children,
  tone = "info"
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "error";
}) {
  return <div className={`ui-toast ui-alert-${tone}`}>{children}</div>;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  title = "Sin registros",
  description = "La vista esta preparada, pero aun no hay datos disponibles."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="ui-state">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="ui-state">
      <span className="ui-spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  title = "No se pudo cargar la vista",
  message
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="ui-state ui-state-error">
      <strong>{title}</strong>
      <span>{message ?? "Revisa la conexion o los permisos requeridos para esta seccion."}</span>
    </div>
  );
}

export function FormField({
  label,
  children,
  error,
  required,
  className = "",
  ...props
}: {
  label?: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-form-field ${className}`.trim()} {...props}>
      {label && (
        <label className="ui-form-label">
          {label}
          {required && <span className="ui-required-mark"> *</span>}
        </label>
      )}
      <div className="ui-field-control">{children}</div>
      {error && <span className="ui-field-error">{error}</span>}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className = "",
  ...props
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-form-section ${className}`.trim()} {...props}>
      <header className="ui-form-section-header">
        <h4 className="ui-form-section-title">{title}</h4>
        {description && <p className="ui-form-section-desc">{description}</p>}
      </header>
      <div className="ui-form-section-content">{children}</div>
    </div>
  );
}

export function FilterBar({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-filter-bar ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
