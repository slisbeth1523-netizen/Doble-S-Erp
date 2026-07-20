import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "./layouts/AppLayout.js";
import { MasterDataRuntimePage } from "./modules/master-data/pages/MasterDataRuntimePage.js";
import { DashboardPreview } from "./pages/DashboardPreview.js";
import { EventsPreview } from "./pages/EventsPreview.js";
import { InventoryAdjustmentsPreview } from "./pages/InventoryAdjustmentsPreview.js";
import { InventoryPhysicalCountsPreview } from "./pages/InventoryPhysicalCountsPreview.js";
import { PurchaseOrdersPreview } from "./pages/PurchaseOrdersPreview.js";
import { PurchaseReceiptsPreview } from "./pages/PurchaseReceiptsPreview.js";
import { SalesOrdersPreview } from "./pages/SalesOrdersPreview.js";
import { SalesQuotationsPreview } from "./pages/SalesQuotationsPreview.js";
import { SalesReservationsPreview } from "./pages/SalesReservationsPreview.js";
import { SalesShipmentsPreview } from "./pages/SalesShipmentsPreview.js";
import { SalesInvoicesPreview } from "./pages/SalesInvoicesPreview.js";
import { SalesReturnsPreview } from "./pages/SalesReturnsPreview.js";
import { SupplierInvoicesPreview } from "./pages/SupplierInvoicesPreview.js";
import { AccountsPayablePreview } from "./pages/AccountsPayablePreview.js";
import { AccountsReceivableDocumentsPreview } from "./pages/AccountsReceivableDocumentsPreview.js";
import { CustomerReceivableBalancesPreview } from "./pages/CustomerReceivableBalancesPreview.js";
import { CustomerAgingPreview } from "./pages/CustomerAgingPreview.js";
import { CustomerCreditNotesPreview } from "./pages/CustomerCreditNotesPreview.js";
import { CustomerReceiptsPreview } from "./pages/CustomerReceiptsPreview.js";
import { CustomerStatementsPreview } from "./pages/CustomerStatementsPreview.js";
import { SupplierPaymentsPreview } from "./pages/SupplierPaymentsPreview.js";
import { SupplierAdjustmentsPreview } from "./pages/SupplierAdjustmentsPreview.js";
import { SupplierAgingPreview } from "./pages/SupplierAgingPreview.js";
import { SupplierStatementsPreview } from "./pages/SupplierStatementsPreview.js";
import { ElectronicInvoicingPreview } from "./pages/ElectronicInvoicingPreview.js";
import { SecurityPreview } from "./pages/SecurityPreview.js";
import { SettingsPreview } from "./pages/SettingsPreview.js";
import { WorkflowsPreview } from "./pages/WorkflowsPreview.js";

import { BalanceSheetPage } from "./pages/accounting/BalanceSheetPage.js";
import { ChartOfAccounts } from "./pages/accounting/ChartOfAccounts.js";
import { AccountingPeriodsPage } from "./pages/accounting/AccountingPeriodsPage.js";
import { GeneralLedgerPage } from "./pages/accounting/GeneralLedgerPage.js";
import { IncomeStatementPage } from "./pages/accounting/IncomeStatementPage.js";
import { JournalEntriesPage } from "./pages/accounting/JournalEntriesPage.js";
import { TrialBalancePage } from "./pages/accounting/TrialBalancePage.js";
import { DgiiReportsDashboard } from "./pages/dgii/DgiiReportsDashboard.js";
import { CertificationWizard } from "./pages/dgii/CertificationWizard.js";

function currentPath() {
  return window.location.pathname === "/" ? "/dashboard" : window.location.pathname;
}

function catalogFromPath(path: string) {
  const segments = path.split("/").filter(Boolean);

  return segments[0] === "master-data" ? segments[1] : undefined;
}

export function App() {
  const [path, setPath] = useState(currentPath);
  const page = useMemo(() => {
    const catalog = catalogFromPath(path);

    if (catalog) {
      return <MasterDataRuntimePage catalog={catalog} />;
    }

    if (path === "/workflows") {
      return <WorkflowsPreview />;
    }

    if (path === "/events") {
      return <EventsPreview />;
    }

    if (path === "/inventory/adjustments") {
      return <InventoryAdjustmentsPreview />;
    }

    if (path === "/inventory/physical-counts") {
      return <InventoryPhysicalCountsPreview />;
    }

    if (path === "/purchasing/purchase-orders") {
      return <PurchaseOrdersPreview />;
    }

    if (path === "/sales/quotations") {
      return <SalesQuotationsPreview />;
    }

    if (path === "/sales/orders") {
      return <SalesOrdersPreview />;
    }

    if (path === "/sales/reservations") {
      return <SalesReservationsPreview />;
    }

    if (path === "/sales/shipments") {
      return <SalesShipmentsPreview />;
    }

    if (path === "/sales/invoices") {
      return <SalesInvoicesPreview />;
    }

    if (path === "/sales/returns") {
      return <SalesReturnsPreview />;
    }

    if (path === "/purchasing/purchase-receipts") {
      return <PurchaseReceiptsPreview />;
    }

    if (path === "/purchasing/supplier-invoices") {
      return <SupplierInvoicesPreview />;
    }

    if (path === "/accounts-payable/documents") {
      return <AccountsPayablePreview />;
    }

    if (path === "/accounts-payable/statements") {
      return <SupplierStatementsPreview />;
    }

    if (path === "/accounts-payable/aging") {
      return <SupplierAgingPreview />;
    }

    if (path === "/accounts-payable/payments") {
      return <SupplierPaymentsPreview />;
    }

    if (path === "/accounts-payable/supplier-adjustments") {
      return <SupplierAdjustmentsPreview />;
    }

    if (path === "/accounts-receivable/documents") {
      return <AccountsReceivableDocumentsPreview />;
    }

    if (path === "/accounts-receivable/statements") {
      return <CustomerStatementsPreview />;
    }

    if (path === "/accounts-receivable/aging") {
      return <CustomerAgingPreview />;
    }

    if (path === "/accounts-receivable/customer-balances") {
      return <CustomerReceivableBalancesPreview />;
    }

    if (path === "/accounts-receivable/receipts") {
      return <CustomerReceiptsPreview />;
    }

    if (path === "/accounts-receivable/customer-credit-notes") {
      return <CustomerCreditNotesPreview />;
    }

    if (path === "/dgii/electronic-invoices") {
      return <ElectronicInvoicingPreview />;
    }

    if (path === "/dgii/reports") {
      return <DgiiReportsDashboard />;
    }

    if (path === "/dgii/certification") {
      return <CertificationWizard />;
    }

    if (path === "/accounting/chart-of-accounts") {
      return <ChartOfAccounts />;
    }

    if (path === "/accounting/periods") {
      return <AccountingPeriodsPage />;
    }

    if (path === "/accounting/journal-entries") {
      return <JournalEntriesPage />;
    }

    if (path === "/accounting/general-ledger") {
      return <GeneralLedgerPage />;
    }

    if (path === "/accounting/trial-balance") {
      return <TrialBalancePage />;
    }

    if (path === "/accounting/income-statement") {
      return <IncomeStatementPage />;
    }

    if (path === "/accounting/balance-sheet") {
      return <BalanceSheetPage />;
    }

    if (path === "/security") {
      return <SecurityPreview />;
    }

    if (path === "/settings") {
      return <SettingsPreview />;
    }

    return <DashboardPreview onNavigate={navigate} />;
  }, [path]);

  useEffect(() => {
    const listener = () => setPath(currentPath());
    window.addEventListener("popstate", listener);

    return () => window.removeEventListener("popstate", listener);
  }, []);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    setPath(currentPath());
  }

  return (
    <AppLayout currentPath={path} onNavigate={navigate}>
      {page}
    </AppLayout>
  );
}
