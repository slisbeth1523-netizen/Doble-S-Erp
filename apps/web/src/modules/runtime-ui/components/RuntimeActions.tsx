import type { RuntimeAction } from "../types/runtime-ui.types.js";

type RuntimeActionsProps = {
  actions: RuntimeAction[];
  onAction?: (action: RuntimeAction["action"]) => void;
};

const actionLabels: Record<RuntimeAction["action"], string> = {
  create: "Create",
  update: "Update",
  activate: "Activate",
  deactivate: "Deactivate",
  lookup: "Lookup",
  export: "Export",
  import: "Import"
};

export function RuntimeActions({ actions, onAction }: RuntimeActionsProps) {
  if (actions.length === 0) {
    return <div className="runtime-state">No actions available.</div>;
  }

  return (
    <div className="runtime-actions" aria-label="Runtime actions">
      {actions.map((action) => {
        const available = action.available ?? Boolean(action.permission);

        return (
          <button
            disabled={!available}
            key={action.action}
            onClick={() => onAction?.(action.action)}
            title={available ? action.permission : "Action not available"}
            type="button"
          >
            {actionLabels[action.action]}
          </button>
        );
      })}
    </div>
  );
}
