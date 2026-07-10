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
    children: [
      { label: "Existencias", path: "/master-data/inventory-stocks" },
      { label: "Movimientos", path: "/master-data/inventory-movements" },
      { label: "Kardex", path: "/master-data/inventory-ledger" },
      { label: "Ajustes", path: "/inventory/adjustments" },
      { label: "Conteos fisicos", path: "/inventory/physical-counts" }
    ]
  },
  {
    label: "Compras",
    path: "/purchasing/purchase-orders",
    children: [
      { label: "Ordenes de compra", path: "/purchasing/purchase-orders" },
      { label: "Recepciones", path: "/purchasing/purchase-receipts" },
      { label: "Facturas proveedor", path: "/purchasing/supplier-invoices" },
      { label: "Consulta ordenes", path: "/master-data/purchase-orders" },
      { label: "Consulta recepciones", path: "/master-data/purchase-receipts" },
      { label: "Proveedores", path: "/master-data/suppliers" }
    ]
  },
  {
    label: "Cuentas por pagar",
    path: "/accounts-payable/documents",
    children: [
      { label: "Documentos", path: "/accounts-payable/documents" },
      { label: "Estado de cuenta", path: "/accounts-payable/statements" },
      { label: "Antiguedad", path: "/accounts-payable/aging" },
      { label: "Pagos", path: "/accounts-payable/payments" },
      { label: "Notas proveedor", path: "/accounts-payable/supplier-adjustments" },
      { label: "Consulta pagos", path: "/master-data/supplier-payments" }
    ]
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
    if (
      segments[1] === "purchase-orders" ||
      segments[1] === "purchase-order-lines" ||
      segments[1] === "purchase-receipts" ||
      segments[1] === "purchase-receipt-lines" ||
      segments[1] === "supplier-invoices" ||
      segments[1] === "supplier-invoice-lines" ||
      segments[1] === "suppliers"
    ) {
      return ["Doble S ERP", "Compras", getCatalogLabel(segments[1] ?? "")];
    }

    if (
      segments[1] === "accounts-payable-documents" ||
      segments[1] === "supplier-statements" ||
      segments[1] === "supplier-aging" ||
      segments[1] === "supplier-payments" ||
      segments[1] === "supplier-payment-applications" ||
      segments[1] === "supplier-adjustments" ||
      segments[1] === "supplier-adjustment-applications"
    ) {
      return ["Doble S ERP", "Cuentas por pagar", getCatalogLabel(segments[1] ?? "")];
    }

    if (
      segments[1] === "inventory-stocks" ||
      segments[1] === "inventory-movements" ||
      segments[1] === "inventory-ledger"
    ) {
      return ["Doble S ERP", "Inventario", getCatalogLabel(segments[1] ?? "")];
    }

    return ["Doble S ERP", "Catalogos", getCatalogLabel(segments[1] ?? "")];
  }

  if (segments[0] === "inventory" && segments[1] === "adjustments") {
    return ["Doble S ERP", "Inventario", "Ajustes"];
  }

  if (segments[0] === "inventory" && segments[1] === "physical-counts") {
    return ["Doble S ERP", "Inventario", "Conteos fisicos"];
  }

  if (segments[0] === "purchasing" && segments[1] === "purchase-orders") {
    return ["Doble S ERP", "Compras", "Ordenes de compra"];
  }

  if (segments[0] === "purchasing" && segments[1] === "purchase-receipts") {
    return ["Doble S ERP", "Compras", "Recepciones"];
  }

  if (segments[0] === "purchasing" && segments[1] === "supplier-invoices") {
    return ["Doble S ERP", "Compras", "Facturas proveedor"];
  }

  if (segments[0] === "accounts-payable" && segments[1] === "documents") {
    return ["Doble S ERP", "Cuentas por pagar", "Documentos"];
  }

  if (segments[0] === "accounts-payable" && segments[1] === "statements") {
    return ["Doble S ERP", "Cuentas por pagar", "Estado de cuenta"];
  }

  if (segments[0] === "accounts-payable" && segments[1] === "aging") {
    return ["Doble S ERP", "Cuentas por pagar", "Antiguedad"];
  }

  if (segments[0] === "accounts-payable" && segments[1] === "payments") {
    return ["Doble S ERP", "Cuentas por pagar", "Pagos"];
  }

  if (segments[0] === "accounts-payable" && segments[1] === "supplier-adjustments") {
    return ["Doble S ERP", "Cuentas por pagar", "Notas proveedor"];
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

function renderIcon(label: string) {
  const commonProps = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { marginRight: "10px", flexShrink: 0 }
  } as const;

  switch (label) {
    case "Dashboard":
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="9"></rect>
          <rect x="14" y="3" width="7" height="5"></rect>
          <rect x="14" y="12" width="7" height="9"></rect>
          <rect x="3" y="16" width="7" height="5"></rect>
        </svg>
      );
    case "Catalogos":
      return (
        <svg {...commonProps}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      );
    case "Inventario":
      return (
        <svg {...commonProps}>
          <polyline points="21 8 21 21 3 21 3 8"></polyline>
          <rect x="1" y="3" width="22" height="5"></rect>
          <line x1="10" y1="12" x2="14" y2="12"></line>
        </svg>
      );
    case "Workflows":
      return (
        <svg {...commonProps}>
          <line x1="6" y1="3" x2="6" y2="15"></line>
          <circle cx="18" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <path d="M18 9a9 9 0 0 1-9 9"></path>
        </svg>
      );
    case "Eventos":
      return (
        <svg {...commonProps}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      );
    case "Compras":
      return (
        <svg {...commonProps}>
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
      );
    case "Cuentas por pagar":
      return (
        <svg {...commonProps}>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      );
    case "Seguridad":
      return (
        <svg {...commonProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      );
    case "Configuracion":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      );
    default:
      return null;
  }
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
                {renderIcon(item.label)}
                <span>{item.label}</span>
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
                      <span style={{
                        display: "inline-block",
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: "currentColor",
                        marginRight: "8px",
                        opacity: currentPath === child.path ? 1 : 0.45
                      }}></span>
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
