import type { RuntimeAction } from "../types/runtime-ui.types.js";

type RuntimeActionsProps = {
  actions: RuntimeAction[];
  onAction?: (action: RuntimeAction["action"]) => void;
};

const actionLabels: Record<RuntimeAction["action"], string> = {
  create: "Crear",
  update: "Actualizar",
  activate: "Activar",
  deactivate: "Desactivar",
  lookup: "Consultar",
  export: "Exportar",
  import: "Importar"
};

export function RuntimeActions({ actions, onAction }: RuntimeActionsProps) {
  if (actions.length === 0) {
    return <div className="runtime-state">No hay acciones disponibles.</div>;
  }

  return (
    <div className="runtime-actions" aria-label="Acciones runtime">
      {actions.map((action) => {
        const available = action.available ?? Boolean(action.permission);

        return (
          <button
            disabled={!available}
            key={action.action}
            onClick={() => onAction?.(action.action)}
            title={available ? action.permission : "Acción no disponible"}
            type="button"
          >
            {actionLabels[action.action]}
          </button>
        );
      })}
    </div>
  );
}
