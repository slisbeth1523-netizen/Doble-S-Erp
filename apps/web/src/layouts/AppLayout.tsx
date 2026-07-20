import { ReactNode, useState, useMemo, useEffect } from "react";

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
      { label: "Disponibilidad", path: "/master-data/item-availability" },
      { label: "Consulta reservas", path: "/master-data/inventory-reservations" },
      { label: "Ajustes", path: "/inventory/adjustments" },
      { label: "Conteos fisicos", path: "/inventory/physical-counts" }
    ]
  },
  {
    label: "Ventas",
    path: "/sales/quotations",
    children: [
      { label: "Cotizaciones", path: "/sales/quotations" },
      { label: "Pedidos", path: "/sales/orders" },
      { label: "Reservas", path: "/sales/reservations" },
      { label: "Despachos", path: "/sales/shipments" },
      { label: "Facturas", path: "/sales/invoices" },
      { label: "Devoluciones", path: "/sales/returns" },
      { label: "Consulta cotizaciones", path: "/master-data/sales-quotations" },
      { label: "Lineas cotizadas", path: "/master-data/sales-quotation-lines" },
      { label: "Consulta pedidos", path: "/master-data/sales-orders" },
      { label: "Lineas pedidos", path: "/master-data/sales-order-lines" },
      { label: "Consulta despachos", path: "/master-data/sales-shipments" },
      { label: "Lineas despachos", path: "/master-data/sales-shipment-lines" },
      { label: "Consulta facturas", path: "/master-data/sales-invoices" },
      { label: "Lineas facturas", path: "/master-data/sales-invoice-lines" },
      { label: "Consulta devoluciones", path: "/master-data/sales-returns" },
      { label: "Lineas devoluciones", path: "/master-data/sales-return-lines" },
      { label: "Clientes", path: "/master-data/customers" }
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
  {
    label: "Cuentas por cobrar",
    path: "/accounts-receivable/documents",
    children: [
      { label: "Documentos", path: "/accounts-receivable/documents" },
      { label: "Estado de cuenta", path: "/accounts-receivable/statements" },
      { label: "Antiguedad", path: "/accounts-receivable/aging" },
      { label: "Saldos por cliente", path: "/accounts-receivable/customer-balances" },
      { label: "Recibos", path: "/accounts-receivable/receipts" },
      { label: "Notas de credito", path: "/accounts-receivable/customer-credit-notes" },
      { label: "Consulta documentos", path: "/master-data/accounts-receivable-documents" },
      { label: "Consulta estados", path: "/master-data/customer-statements" },
      { label: "Consulta antiguedad", path: "/master-data/customer-aging" },
      { label: "Consulta recibos", path: "/master-data/customer-receipts" },
      { label: "Consulta notas credito", path: "/master-data/customer-credit-notes" },
      { label: "Consulta saldos", path: "/master-data/customer-receivable-balances" }
    ]
  },
  {
    label: "Facturación Fiscal",
    path: "/dgii/electronic-invoices",
    children: [
      { label: "Comprobantes e-CF", path: "/dgii/electronic-invoices" },
      { label: "Reportes DGII", path: "/dgii/reports" },
      { label: "Certificación e-CF", path: "/dgii/certification" }
    ]
  },
  {
    label: "Contabilidad",
    path: "/accounting/chart-of-accounts",
    children: [
      { label: "Catálogo de Cuentas", path: "/accounting/chart-of-accounts" },
      { label: "Centros de costo", path: "/master-data/cost-centers" },
      { label: "Periodos contables", path: "/accounting/periods" },
      { label: "Asientos contables", path: "/accounting/journal-entries" },
      { label: "Libro Mayor", path: "/accounting/general-ledger" },
      { label: "Balance de Comprobación", path: "/accounting/trial-balance" },
      { label: "Estado de Resultados", path: "/accounting/income-statement" },
      { label: "Balance General", path: "/accounting/balance-sheet" }
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
      segments[1] === "sales-quotations" ||
      segments[1] === "sales-quotation-lines" ||
      segments[1] === "sales-orders" ||
      segments[1] === "sales-order-lines" ||
      segments[1] === "sales-shipments" ||
      segments[1] === "sales-shipment-lines" ||
      segments[1] === "sales-order-shipments" ||
      segments[1] === "sales-invoices" ||
      segments[1] === "sales-invoice-lines" ||
      segments[1] === "sales-order-invoices" ||
      segments[1] === "sales-shipment-invoices" ||
      segments[1] === "sales-returns" ||
      segments[1] === "sales-return-lines" ||
      segments[1] === "sales-shipment-returns" ||
      segments[1] === "sales-invoice-returns"
    ) {
      return ["Doble S ERP", "Ventas", getCatalogLabel(segments[1] ?? "")];
    }

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

    if (segments[1] === "cost-centers") {
      return ["Doble S ERP", "Contabilidad", getCatalogLabel(segments[1] ?? "")];
    }

    if (
      segments[1] === "accounts-receivable-documents" ||
      segments[1] === "customer-receipts" ||
      segments[1] === "customer-receipt-applications" ||
      segments[1] === "customer-credit-notes" ||
      segments[1] === "customer-credit-note-applications" ||
      segments[1] === "customer-statements" ||
      segments[1] === "customer-aging" ||
      segments[1] === "customer-receivable-balances"
    ) {
      return ["Doble S ERP", "Cuentas por cobrar", getCatalogLabel(segments[1] ?? "")];
    }

    if (
      segments[1] === "inventory-stocks" ||
      segments[1] === "inventory-movements" ||
      segments[1] === "inventory-ledger" ||
      segments[1] === "item-availability" ||
      segments[1] === "inventory-reservations" ||
      segments[1] === "sales-order-reservations"
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

  if (segments[0] === "sales" && segments[1] === "quotations") {
    return ["Doble S ERP", "Ventas", "Cotizaciones"];
  }

  if (segments[0] === "sales" && segments[1] === "orders") {
    return ["Doble S ERP", "Ventas", "Pedidos"];
  }

  if (segments[0] === "sales" && segments[1] === "reservations") {
    return ["Doble S ERP", "Ventas", "Reservas"];
  }

  if (segments[0] === "sales" && segments[1] === "shipments") {
    return ["Doble S ERP", "Ventas", "Despachos"];
  }

  if (segments[0] === "sales" && segments[1] === "invoices") {
    return ["Doble S ERP", "Ventas", "Facturas"];
  }

  if (segments[0] === "sales" && segments[1] === "returns") {
    return ["Doble S ERP", "Ventas", "Devoluciones"];
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

  if (segments[0] === "accounts-receivable" && segments[1] === "documents") {
    return ["Doble S ERP", "Cuentas por cobrar", "Documentos"];
  }

  if (segments[0] === "accounts-receivable" && segments[1] === "statements") {
    return ["Doble S ERP", "Cuentas por cobrar", "Estado de cuenta"];
  }

  if (segments[0] === "accounts-receivable" && segments[1] === "aging") {
    return ["Doble S ERP", "Cuentas por cobrar", "Antiguedad"];
  }

  if (segments[0] === "accounts-receivable" && segments[1] === "customer-balances") {
    return ["Doble S ERP", "Cuentas por cobrar", "Saldos por cliente"];
  }

  if (segments[0] === "accounts-receivable" && segments[1] === "receipts") {
    return ["Doble S ERP", "Cuentas por cobrar", "Recibos"];
  }

  if (segments[0] === "accounts-receivable" && segments[1] === "customer-credit-notes") {
    return ["Doble S ERP", "Cuentas por cobrar", "Notas de credito"];
  }

  if (segments[0] === "accounting" && segments[1] === "periods") {
    return ["Doble S ERP", "Contabilidad", "Periodos contables"];
  }

  if (segments[0] === "accounting" && segments[1] === "journal-entries") {
    return ["Doble S ERP", "Contabilidad", "Asientos contables"];
  }

  if (segments[0] === "accounting" && segments[1] === "general-ledger") {
    return ["Doble S ERP", "Contabilidad", "Libro Mayor"];
  }

  if (segments[0] === "accounting" && segments[1] === "trial-balance") {
    return ["Doble S ERP", "Contabilidad", "Balance de Comprobación"];
  }

  if (segments[0] === "accounting" && segments[1] === "income-statement") {
    return ["Doble S ERP", "Contabilidad", "Estado de Resultados"];
  }

  if (segments[0] === "accounting" && segments[1] === "balance-sheet") {
    return ["Doble S ERP", "Contabilidad", "Balance General"];
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
    case "Ventas":
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
    case "Cuentas por cobrar":
      return (
        <svg {...commonProps}>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
          <path d="M16 14h3l-3 3"></path>
          <path d="M19 14h-7a3 3 0 0 0 0 6h1"></path>
        </svg>
      );
    case "Facturación Fiscal":
      return (
        <svg {...commonProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
    case "Contabilidad":
      return (
        <svg {...commonProps}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <line x1="22" y1="6" x2="2" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="22"></line>
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
  
  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navigation.forEach((item) => {
      if (item.children?.some((child) => child.path === currentPath)) {
        initial[item.label] = true;
      }
    });
    return initial;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchItems = [
    { label: "Clientes", category: "Catálogos / Ventas", path: "/master-data/customers" },
    { label: "Proveedores", category: "Catálogos / Compras", path: "/master-data/suppliers" },
    { label: "Artículos", category: "Catálogos / Inventario", path: "/master-data/items" },
    { label: "Categorías", category: "Catálogos", path: "/master-data/categories" },
    { label: "Marcas", category: "Catálogos", path: "/master-data/brands" },
    { label: "Almacenes", category: "Catálogos", path: "/master-data/warehouses" },
    { label: "Existencias de Inventario", category: "Inventario", path: "/master-data/inventory-stocks" },
    { label: "Movimientos de Inventario", category: "Inventario", path: "/master-data/inventory-movements" },
    { label: "Kardex de Inventario", category: "Inventario", path: "/master-data/inventory-ledger" },
    { label: "Ajustes de Inventario", category: "Inventario", path: "/inventory/adjustments" },
    { label: "Conteos Físicos", category: "Inventario", path: "/inventory/physical-counts" },
    { label: "Órdenes de Compra", category: "Compras", path: "/purchasing/purchase-orders" },
    { label: "Recepciones de Compra", category: "Compras", path: "/purchasing/purchase-receipts" },
    { label: "Facturas de Proveedor", category: "Compras / CxP", path: "/purchasing/supplier-invoices" },
    { label: "Devoluciones de Venta", category: "Ventas / Inventario", path: "/sales/returns" },
    { label: "Documentos de CxP (Cuentas por pagar)", category: "Cuentas por pagar", path: "/accounts-payable/documents" },
    { label: "Pagos a Proveedores", category: "Cuentas por pagar", path: "/accounts-payable/payments" },
    { label: "Comprobantes Fiscales e-CF", category: "Facturación Fiscal / DGII", path: "/dgii/electronic-invoices" },
    { label: "Reportes DGII (606, 607, 608, 609)", category: "Facturación Fiscal / DGII", path: "/dgii/reports" },
    { label: "Certificación e-CF (Emisor Electrónico)", category: "Facturación Fiscal / DGII", path: "/dgii/certification" },
    { label: "Catálogo de Cuentas Contables", category: "Contabilidad", path: "/accounting/chart-of-accounts" },
    { label: "Centros de costo", category: "Contabilidad", path: "/master-data/cost-centers" },
    { label: "Periodos contables", category: "Contabilidad", path: "/accounting/periods" },
    { label: "Asientos contables", category: "Contabilidad", path: "/accounting/journal-entries" },
    { label: "Libro Mayor", category: "Contabilidad", path: "/accounting/general-ledger" },
    { label: "Balance de Comprobación", category: "Contabilidad", path: "/accounting/trial-balance" },
    { label: "Estado de Resultados", category: "Contabilidad", path: "/accounting/income-statement" },
    { label: "Balance General", category: "Contabilidad", path: "/accounting/balance-sheet" },
    { label: "Seguridad y Accesos", category: "Configuración", path: "/security" },
    { label: "Configuración General", category: "Configuración", path: "/settings" }
  ];

  const filteredSearch = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return searchItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className={`app-layout ${isSidebarCollapsed ? "app-layout-collapsed" : ""}`}>
      <aside className={`app-sidebar ${isSidebarCollapsed ? "app-sidebar-collapsed" : ""} ${isMobileMenuOpen ? "app-sidebar-mobile-open" : ""}`}>
        <button className="brand" onClick={() => onNavigate("/dashboard")} type="button">
          <span className="brand-mark">DS</span>
          {!isSidebarCollapsed && (
            <span>
              <strong>Doble S ERP</strong>
              <small>Vista de desarrollo</small>
            </span>
          )}
        </button>

        <nav aria-label="Principal" className="sidebar-nav">
          {navigation.map((item) => {
            const isGroupExpanded = expandedGroups[item.label];
            const isGroupActive = isActive(currentPath, item);
            return (
              <div className="nav-group" key={item.label}>
                <button
                  className={isGroupActive ? "nav-link nav-link-active" : "nav-link"}
                  onClick={() => {
                    if (item.children) {
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [item.label]: !prev[item.label]
                      }));
                    } else {
                      onNavigate(item.path);
                    }
                  }}
                  type="button"
                >
                  {renderIcon(item.label)}
                  {!isSidebarCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                  {!isSidebarCollapsed && item.children && (
                    <svg
                      className="group-arrow"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{
                        transform: isGroupExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s"
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                </button>
                {item.children && isGroupExpanded && !isSidebarCollapsed ? (
                  <div className="nav-children">
                    {item.children.map((child) => (
                      <button
                        className={
                          currentPath === child.path ? "nav-link nav-link-child nav-link-active" : "nav-link nav-link-child"
                        }
                        key={child.path}
                        onClick={() => {
                          onNavigate(child.path);
                          setIsMobileMenuOpen(false);
                        }}
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
            );
          })}
        </nav>

        {/* Collapsible toggle button */}
        <button
          className="toggle-collapse-btn"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          type="button"
          title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {isSidebarCollapsed ? (
              <polyline points="13 17 18 12 13 7 M6 17 11 12 6 7" />
            ) : (
              <polyline points="11 17 6 12 11 7 M18 17 13 12 18 7" />
            )}
          </svg>
        </button>
      </aside>

      <section className="app-main-shell">
        <header className="app-topbar">
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isMobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>

          <div className="breadcrumb" aria-label="Ruta actual">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`}>{crumb}</span>
            ))}
          </div>

          {/* Global Search Component */}
          <div className="global-search-container">
            <svg className="global-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              className="global-search-input"
              type="text"
              placeholder="Buscar clientes, facturas, compras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {filteredSearch.length > 0 && (
              <div className="global-search-dropdown">
                {filteredSearch.map((item) => (
                  <button
                    key={item.path}
                    className="global-search-item"
                    onClick={() => {
                      onNavigate(item.path);
                      setSearchQuery("");
                    }}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <small>{item.category}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Component */}
          <div className="quick-actions-bar">
            <button className="quick-action-btn" onClick={() => onNavigate("/purchasing/supplier-invoices")} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva factura de proveedor
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate("/accounts-payable/payments")} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
              Registrar pago a proveedor
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate("/purchasing/purchase-orders")} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Nueva orden de compra
            </button>
          </div>

          <div className="tenant-pill">
            <Badge tone="blue">Entorno Demo</Badge>
            <span>Bienvenido</span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </section>
    </div>
  );
}
