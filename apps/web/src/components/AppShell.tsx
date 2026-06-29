import { apiUrl } from "../services/apiClient.js";

export function AppShell() {
  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">Doble S ERP</p>
        <h1>Base tecnica SaaS lista para crecer</h1>
        <p>
          Monorepo inicial con API, frontend, SQL Server y tipos compartidos para preparar los
          futuros modulos del ERP.
        </p>
        <div className="status">
          <span>API</span>
          <code>{apiUrl}</code>
        </div>
      </section>
    </main>
  );
}

