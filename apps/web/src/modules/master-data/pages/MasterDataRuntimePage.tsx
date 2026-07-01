import { useMemo, useState } from "react";

import { DynamicForm } from "../../runtime-ui/components/DynamicForm.js";
import { DynamicGrid } from "../../runtime-ui/components/DynamicGrid.js";
import { RuntimeActions } from "../../runtime-ui/components/RuntimeActions.js";
import { useCatalogMetadata } from "../../runtime-ui/hooks/useCatalogMetadata.js";
import type { RuntimeFormValues } from "../../runtime-ui/utils/validationRuntime.js";

type MasterDataRuntimePageProps = {
  catalog?: string;
};

function catalogFromLocation() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const masterDataIndex = segments.indexOf("master-data");
  return masterDataIndex >= 0 ? segments[masterDataIndex + 1] : undefined;
}

export function MasterDataRuntimePage({ catalog }: MasterDataRuntimePageProps) {
  const resolvedCatalog = catalog ?? catalogFromLocation() ?? "currencies";
  const metadata = useCatalogMetadata(resolvedCatalog);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const title = useMemo(
    () => metadata.data?.catalog.displayName ?? resolvedCatalog,
    [metadata.data, resolvedCatalog]
  );

  return (
    <main className="master-data-runtime-page">
      <header className="runtime-page-header">
        <div>
          <p className="eyebrow">Master Data Runtime</p>
          <h1>{title}</h1>
        </div>
        {metadata.data ? (
          <RuntimeActions
            actions={metadata.data.actions}
            onAction={(action) => setLastAction(`${action} is prepared by metadata.`)}
          />
        ) : null}
      </header>

      {metadata.loading ? <div className="runtime-state">Loading catalog runtime...</div> : null}
      {metadata.error ? <div className="runtime-state runtime-error">{metadata.error}</div> : null}
      {lastAction ? <div className="runtime-state">{lastAction}</div> : null}

      <section className="runtime-layout runtime-layout-two">
        <div className="runtime-panel">
          <h2>Records</h2>
          <DynamicGrid catalog={resolvedCatalog} />
        </div>
        <aside className="runtime-panel">
          <h2>Form</h2>
          <DynamicForm
            catalog={resolvedCatalog}
            onSubmit={(values: RuntimeFormValues) =>
              setLastAction(`Form is valid with ${Object.keys(values).length} fields.`)
            }
          />
        </aside>
      </section>
    </main>
  );
}
