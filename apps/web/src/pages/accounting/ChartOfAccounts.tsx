import { useState, useEffect } from "react";
import { PageHeader, Badge, Card, Button, Input, Select, FormField } from "../../components/ui/index.js";
import {
  activateAccountingAccount,
  blockAccountingAccount,
  createAccountingAccount,
  deactivateAccountingAccount,
  listAccountingAccounts,
  unblockAccountingAccount,
  updateAccountingAccount,
  type AccountingAccount,
  type AccountingAccountPayload
} from "../../services/accountingAccountsClient.js";

const emptyPayload: AccountingAccountPayload = {
  code: "",
  name: "",
  description: "",
  parentAccountId: undefined,
  accountType: "ASSET",
  normalBalance: "DEBIT",
  classification: "",
  allowsPosting: true,
  requiresCostCenter: false,
  requiresThirdParty: false,
  isControlAccount: false,
  currencyCode: "DOP",
  validFrom: "",
  validTo: ""
};

const accountTypeLabels: Record<string, string> = {
  ASSET: "Activo",
  LIABILITY: "Pasivo",
  EQUITY: "Patrimonio",
  REVENUE: "Ingreso",
  EXPENSE: "Gasto",
  COST: "Costo",
  MEMO: "Memorando"
};

function toPayload(account: AccountingAccount): AccountingAccountPayload {
  return {
    code: account.code,
    name: account.name,
    description: account.description ?? "",
    parentAccountId: account.parentAccountId,
    accountType: account.accountType,
    normalBalance: account.normalBalance,
    classification: account.classification ?? "",
    allowsPosting: account.allowsPosting,
    requiresCostCenter: account.requiresCostCenter,
    requiresThirdParty: account.requiresThirdParty,
    isControlAccount: account.isControlAccount,
    currencyCode: account.currencyCode ?? "",
    validFrom: account.validFrom?.slice(0, 10) ?? "",
    validTo: account.validTo?.slice(0, 10) ?? ""
  };
}

function cleanPayload(payload: AccountingAccountPayload): AccountingAccountPayload {
  return {
    ...payload,
    description: payload.description?.trim() || undefined,
    parentAccountId: payload.parentAccountId || undefined,
    classification: payload.classification?.trim() || undefined,
    currencyCode: payload.currencyCode?.trim() || undefined,
    validFrom: payload.validFrom || undefined,
    validTo: payload.validTo || undefined
  };
}

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedAccount, setSelectedAccount] = useState<AccountingAccount | null>(null);
  const [form, setForm] = useState<AccountingAccountPayload>(emptyPayload);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [legacyLocalStorageDetected, setLegacyLocalStorageDetected] = useState(false);

  async function loadAccounts() {
    try {
      setLoading(true);
      const result = await listAccountingAccounts({ search, accountType: typeFilter, pageSize: 200 });
      setAccounts(result.records);
      setExpanded((current) => {
        if (Object.keys(current).length > 0) return current;
        return result.records.reduce<Record<string, boolean>>((acc, account) => ({ ...acc, [account.accountId]: account.level <= 3 }), {});
      });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el plan de cuentas desde la API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLegacyLocalStorageDetected(Boolean(localStorage.getItem("dobles_erp_accounts")));
    loadAccounts();
  }, []);

  const handleSelectAccount = (acc: AccountingAccount) => {
    setSelectedAccount(acc);
    setForm(toPayload(acc));
    setIsEditing(true);
  };

  const handleNewAccount = () => {
    setSelectedAccount(null);
    setForm({
      ...emptyPayload,
      code: selectedAccount ? `${selectedAccount.code}-001` : "",
      normalBalance: selectedAccount ? selectedAccount.normalBalance : "DEBIT",
      accountType: selectedAccount ? selectedAccount.accountType : "ASSET",
      parentAccountId: selectedAccount ? selectedAccount.accountId : undefined
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = cleanPayload(form);
      const saved = isEditing && selectedAccount
        ? await updateAccountingAccount(selectedAccount.accountId, payload)
        : await createAccountingAccount(payload);
      setMessage(isEditing ? "Cuenta actualizada correctamente." : "Cuenta creada correctamente.");
      setSelectedAccount(saved);
      setForm(toPayload(saved));
      setIsEditing(true);
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async () => {
    if (!selectedAccount) return;
    const reason = prompt("Motivo de bloqueo");
    if (!reason?.trim()) {
      setMessage("Indica un motivo para bloquear la cuenta.");
      return;
    }
    const updated = await blockAccountingAccount(selectedAccount.accountId, reason.trim());
    setSelectedAccount(updated);
    setForm(toPayload(updated));
    setMessage("Cuenta bloqueada correctamente.");
    await loadAccounts();
  };

  const handleUnblock = async () => {
    if (!selectedAccount) return;
    const updated = await unblockAccountingAccount(selectedAccount.accountId);
    setSelectedAccount(updated);
    setForm(toPayload(updated));
    setMessage("Cuenta desbloqueada correctamente.");
    await loadAccounts();
  };

  const handleToggleActive = async () => {
    if (!selectedAccount) return;
    const updated = selectedAccount.isActive
      ? await deactivateAccountingAccount(selectedAccount.accountId)
      : await activateAccountingAccount(selectedAccount.accountId);
    setSelectedAccount(updated);
    setForm(toPayload(updated));
    setMessage(selectedAccount.isActive ? "Cuenta desactivada correctamente." : "Cuenta activada correctamente.");
    await loadAccounts();
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (pId?: string) => {
    const nodes = accounts.filter(acc => (acc.parentAccountId ?? undefined) === pId);
    if (nodes.length === 0) return null;

    return (
      <ul style={{ listStyleType: "none", paddingLeft: pId ? "16px" : "0", margin: 0 }}>
        {nodes.map(node => {
          const hasChildren = accounts.some(acc => acc.parentAccountId === node.accountId);
          const isExpanded = expanded[node.accountId];
          const isSelected = selectedAccount?.accountId === node.accountId;

          return (
            <li key={node.accountId} style={{ margin: "4px 0" }}>
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  padding: "6px 10px", 
                  background: isSelected ? "var(--primary-light)" : (!node.allowsPosting ? "var(--surface-muted)" : "transparent"),
                  border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "var(--transition)",
                  gap: "8px",
                  opacity: node.isActive ? 1 : 0.58
                }}
                onClick={() => handleSelectAccount(node)}
              >
                <div 
                  style={{ width: "20px", display: "flex", justifyContent: "center" }}
                  onClick={(e) => hasChildren && toggleExpand(node.accountId, e)}
                >
                  {hasChildren ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ 
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                        opacity: 0.6
                      }}
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  ) : (
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--muted)" }}></span>
                  )}
                </div>
                
                <span style={{ fontWeight: 600, width: "130px", fontSize: "0.85rem", color: "var(--color-primary-400)", fontFamily: "monospace", textAlign: "left" }}>
                  {node.code}
                </span>
                
                <span style={{ flex: 1, fontSize: "0.9rem", fontWeight: !node.allowsPosting ? 600 : 400, textAlign: "left" }}>
                  {node.name}
                </span>
                
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <Badge tone={node.normalBalance === "DEBIT" ? "blue" : "neutral"}>
                    {node.normalBalance === "DEBIT" ? "Deudora" : "Acreedora"}
                  </Badge>
                  <Badge tone={!node.allowsPosting ? "neutral" : "green"}>
                    {!node.allowsPosting ? "Control" : "Movimiento"}
                  </Badge>
                  {node.isBlocked ? <Badge tone="amber">Bloqueada</Badge> : null}
                </div>
              </div>
              
              {isExpanded && renderTree(node.accountId)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      <PageHeader
        eyebrow="Contabilidad"
        title="Catálogo de cuentas contables"
        description="Administra la estructura y clasificación de las cuentas utilizadas en la contabilidad."
        actions={<Button variant="primary" onClick={handleNewAccount}>Nueva Cuenta</Button>}
      />

      {legacyLocalStorageDetected ? (
        <Card>
          <div style={{ padding: "14px 18px", color: "var(--text-secondary)" }}>
            Se detectaron datos anteriores en este navegador. La fuente oficial ahora es SQL Server mediante API; no se importaron ni eliminaron datos locales.
          </div>
        </Card>
      ) : null}

      {message ? (
        <Card>
          <div style={{ padding: "14px 18px", color: "var(--text-secondary)" }}>{message}</div>
        </Card>
      ) : null}

      <div className="accounts-layout" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        {/* Left Side: Tree View */}
        <Card style={{ flex: "1 1 500px" }}>
          <div style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Árbol Jerárquico</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" onClick={() => setExpanded({})}>Colapsar Todo</Button>
                <Button variant="secondary" onClick={() => {
                  const allKeys = accounts.reduce((acc, curr) => ({ ...acc, [curr.accountId]: true }), {});
                  setExpanded(allKeys);
                }}>Expandir Todo</Button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cuenta" />
              <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Todos</option>
                <option value="ASSET">Activo</option>
                <option value="LIABILITY">Pasivo</option>
                <option value="EQUITY">Patrimonio</option>
                <option value="REVENUE">Ingreso</option>
                <option value="EXPENSE">Gasto</option>
                <option value="COST">Costo</option>
                <option value="MEMO">Memorando</option>
              </Select>
              <Button variant="secondary" onClick={loadAccounts}>Aplicar</Button>
            </div>
            
            <div style={{ 
              border: "1px solid var(--border)", 
              borderRadius: "var(--radius)", 
              padding: "16px", 
              background: "var(--surface-muted)",
              maxHeight: "600px",
              overflowY: "auto"
            }}>
              {loading ? "Cargando plan de cuentas..." : accounts.length > 0 ? renderTree(undefined) : "Sin cuentas registradas."}
            </div>
          </div>
        </Card>

        {/* Right Side: Form Panel */}
        <Card style={{ flex: "1 1 350px" }}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                {isEditing ? "Detalle de Cuenta" : "Crear Nueva Cuenta"}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                {isEditing ? "Modifique o administre la cuenta seleccionada." : "Defina los atributos de la cuenta."}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <FormField label="Código Contable">
                <Input 
                  type="text" 
                  value={form.code} 
                  onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))}
                  placeholder="1-01-001"
                  required
                  style={{ fontFamily: "monospace" }}
                />
              </FormField>

              <FormField label="Nombre de Cuenta">
                <Input 
                  type="text" 
                  value={form.name} 
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Ej. Caja general"
                  required
                />
              </FormField>

              <FormField label="Tipo de Cuenta">
                <Select 
                  value={form.accountType} 
                  onChange={(e) => setForm((current) => ({ ...current, accountType: e.target.value }))}
                >
                  {Object.entries(accountTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Origen / Naturaleza">
                <Select 
                  value={form.normalBalance} 
                  onChange={(e) => setForm((current) => ({ ...current, normalBalance: e.target.value }))}
                >
                  <option value="DEBIT">Deudora (Débito)</option>
                  <option value="CREDIT">Acreedora (Crédito)</option>
                </Select>
              </FormField>

              <FormField label="Cuenta Padre">
                <Select 
                  value={form.parentAccountId || ""} 
                  onChange={(e) => setForm((current) => ({ ...current, parentAccountId: e.target.value || undefined }))}
                >
                  <option value="">Ninguna (Raíz)</option>
                  {accounts.filter(acc => !acc.allowsPosting && acc.accountId !== selectedAccount?.accountId).map(acc => (
                    <option key={acc.accountId} value={acc.accountId}>{acc.code} - {acc.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Movimiento">
                <Select
                  value={form.allowsPosting ? "true" : "false"}
                  onChange={(e) => setForm((current) => ({ ...current, allowsPosting: e.target.value === "true", isControlAccount: e.target.value !== "true" }))}
                >
                  <option value="true">Sí, acepta movimientos</option>
                  <option value="false">No, agrupadora/control</option>
                </Select>
              </FormField>

              <FormField label="Moneda">
                <Input
                  type="text"
                  value={form.currencyCode ?? ""}
                  onChange={(e) => setForm((current) => ({ ...current, currencyCode: e.target.value.toUpperCase() }))}
                  placeholder="DOP"
                  maxLength={3}
                />
              </FormField>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                <Button type="submit" variant="primary" disabled={saving} style={{ flex: 1 }}>
                  {isEditing ? "Guardar Cambios" : "Crear Cuenta"}
                </Button>
                {isEditing && selectedAccount && (
                  <>
                    <Button type="button" variant="secondary" onClick={selectedAccount.isBlocked ? handleUnblock : handleBlock}>
                      {selectedAccount.isBlocked ? "Desbloquear" : "Bloquear"}
                    </Button>
                    <Button type="button" variant="danger" onClick={handleToggleActive}>
                      {selectedAccount.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </>
                )}
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
