import type { ReactNode } from "react";

import { Badge } from "../components/ui/index.js";
import { getCatalogLabel } from "../modules/master-data/utils/catalogLabels.js";

type NavigationItem = {
  label: string;
  path: string;
  children?: NavigationItem[];
};

const navigation: NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  {
    label: "Catalogos",
    path: "/master-data/customers",
    children: [
      { label: "Clientes", path: "/master-data/customers" },
      { label: "Proveedores", path: "/master-data/suppliers" },
      { label: "Articulos", path: "/master-data/items" },
      { label: "Categorias", path: "/master-data/categories" },
      { label: "Marcas", path: "/master-data/brands" },
      { label: "Almacenes", path: "/master-data/warehouses" },
      { label: "Monedas", path: "/master-data/currencies" },
      { label: "Unidades de medida", path: "/master-data/units-of-measure" },
      { label: "Condiciones de pago", path: "/master-data/payment-terms" },
      { label: "Categorias fiscales", path: "/master-data/tax-categories" }
    ]
  },
  {
    label: "Inventario",
    path: "/master-data/inventory-stocks",
    children: [{ label: "Existencias", path: "/master-data/inventory-stocks" }]
  },
  { label: "Workflows", path: "/workflows" },
  { label: "Eventos", path: "/events" },
  { label: "Seguridad", path: "/security" },
  { label: "Configuracion", path: "/settings" }
];

type AppLayoutProps = {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
};

function isActive(currentPath: string, item: NavigationItem) {
  if (item.children?.some((child) => currentPath === child.path)) {
    return true;
  }

  if (item.path === "/dashboard") {
    return currentPath === "/" || currentPath === "/dashboard";
  }

  return currentPath === item.path || currentPath.startsWith(`${item.path}/`);
}

function breadcrumb(path: string) {
  const segments = path === "/" ? ["dashboard"] : path.split("/").filter(Boolean);

  if (segments[0] === "master-data") {
    if (segments[1] === "inventory-stocks") {
      return ["Doble S ERP", "Inventario", getCatalogLabel(segments[1] ?? "")];
    }

    return ["Doble S ERP", "Catalogos", getCatalogLabel(segments[1] ?? "")];
  }

  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    workflows: "Workflows",
    events: "Eventos",
    security: "Seguridad",
    settings: "Configuracion"
  };

  return ["Doble S ERP", ...segments.map((segment) => labels[segment] ?? segment.replaceAll("-", " "))];
}

export function AppLayout({ children, currentPath, onNavigate }: AppLayoutProps) {
  const crumbs = breadcrumb(currentPath);

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <button className="brand" onClick={() => onNavigate("/dashboard")} type="button">
          <span className="brand-mark">DS</span>
          <span>
            <strong>Doble S ERP</strong>
            <small>Vista de desarrollo</small>
          </span>
        </button>

        <nav aria-label="Principal" className="sidebar-nav">
          {navigation.map((item) => (
            <div className="nav-group" key={item.label}>
              <button
                className={isActive(currentPath, item) ? "nav-link nav-link-active" : "nav-link"}
                onClick={() => onNavigate(item.path)}
                type="button"
              >
                {item.label}
              </button>
              {item.children ? (
                <div className="nav-children">
                  {item.children.map((child) => (
                    <button
                      className={
                        currentPath === child.path ? "nav-link nav-link-child nav-link-active" : "nav-link nav-link-child"
                      }
                      key={child.path}
                      onClick={() => onNavigate(child.path)}
                      type="button"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </aside>

      <section className="app-main-shell">
        <header className="app-topbar">
          <div className="breadcrumb" aria-label="Ruta actual">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`}>{crumb}</span>
            ))}
          </div>
          <div className="tenant-pill">
            <Badge tone="blue">Vista previa</Badge>
            <span>Usuario demo</span>
            <strong>Empresa actual</strong>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </section>
    </div>
  );
}
