import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  FilterBar,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Table,
  Textarea
} from "../../components/ui/index.js";
import { listAccountingAccounts, type AccountingAccount } from "../../services/accountingAccountsClient.js";
import {
  createPostingRule,
  deletePostingRule,
  listPostingRules,
  updatePostingRule,
  type PostingRule,
  type PostingRulePayload
} from "../../services/accountingPostingRulesClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultPayload: PostingRulePayload = {
  ruleCode: "",
  name: "",
  description: "",
  sourceModule: "ACCOUNTS_RECEIVABLE",
  sourceDocumentType: "AR_DOCUMENT",
  direction: "RECEIVABLE",
  debitAccountId: "",
  creditAccountId: "",
  taxAccountId: null,
  costCenterId: null,
  appliesTax: true,
  priority: 100,
  isDefault: false,
  isActive: true
};

const sourceOptions = [
  { module: "ACCOUNTS_RECEIVABLE", type: "AR_DOCUMENT", direction: "RECEIVABLE", label: "Documento CxC" },
  { module: "ACCOUNTS_PAYABLE", type: "AP_DOCUMENT", direction: "PAYABLE", label: "Documento CxP" },
  { module: "SALES", type: "SALES_INVOICE", direction: "RECEIVABLE", label: "Factura de venta" },
  { module: "PURCHASING", type: "SUPPLIER_INVOICE", direction: "PAYABLE", label: "Factura proveedor" }
] as const;

function accountLabel(account?: AccountingAccount) {
  return account ? `${account.code} ${account.name}` : "Sin cuenta";
}

function rulePayloadFrom(rule: PostingRule): PostingRulePayload {
  return {
    ruleCode: rule.ruleCode,
    name: rule.name,
    description: rule.description ?? "",
    sourceModule: rule.sourceModule,
    sourceDocumentType: rule.sourceDocumentType,
    direction: rule.direction,
    debitAccountId: rule.debitAccountId,
    creditAccountId: rule.creditAccountId,
    taxAccountId: rule.taxAccountId ?? null,
    costCenterId: null,
    appliesTax: rule.appliesTax,
    priority: rule.priority,
    isDefault: rule.isDefault,
    isActive: rule.isActive
  };
}

export function AccountingPostingRulesPage() {
  const [rules, setRules] = useState<PostingRule[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [payload, setPayload] = useState<PostingRulePayload>(defaultPayload);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.accountId, account])),
    [accounts]
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [ruleResult, accountResult] = await Promise.all([
        listPostingRules({ pageSize: 200 }),
        listAccountingAccounts({ pageSize: 500 })
      ]);
      setRules(ruleResult.records);
      setAccounts(accountResult.records.filter((account) => account.allowsPosting && account.isActive && !account.isBlocked));
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar las reglas contables."
      });
    } finally {
      setLoading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!payload.debitAccountId || !payload.creditAccountId) {
      setFeedback({ tone: "warning", message: "Selecciona las cuentas debito y credito." });
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await updatePostingRule(editingId, payload);
      } else {
        await createPostingRule(payload);
      }
      setPayload(defaultPayload);
      setEditingId(null);
      setFeedback({ tone: "success", message: "Regla contable guardada e invalidada en cache." });
      await load();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar la regla contable."
      });
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(rule: PostingRule) {
    try {
      setSaving(true);
      await deletePostingRule(rule.postingRuleId);
      setFeedback({ tone: "success", message: "Regla contable desactivada e invalidada en cache." });
      await load();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo desactivar la regla contable."
      });
    } finally {
      setSaving(false);
    }
  }

  function selectSource(value: string) {
    const option = sourceOptions.find((item) => item.type === value) ?? sourceOptions[0];
    setPayload((current) => ({
      ...current,
      sourceModule: option.module,
      sourceDocumentType: option.type,
      direction: option.direction
    }));
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Reglas Contables"
        description="Mantenimiento de reglas configurables para el motor contable automatico."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/posting-engine">
              Motor Contable
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/chart-of-accounts">
              Catalogo de Cuentas
            </a>
          </div>
        }
      />

      {feedback ? (
        <Alert tone={feedback.tone} title={feedback.tone === "error" ? "Atencion" : undefined}>
          {feedback.message}
        </Alert>
      ) : null}

      <Card>
        <form onSubmit={save}>
          <FilterBar>
            <FormField label="Codigo" required>
              <Input
                disabled={saving}
                value={payload.ruleCode}
                onChange={(event) => setPayload((current) => ({ ...current, ruleCode: event.target.value }))}
              />
            </FormField>
            <FormField label="Nombre" required>
              <Input
                disabled={saving}
                value={payload.name}
                onChange={(event) => setPayload((current) => ({ ...current, name: event.target.value }))}
              />
            </FormField>
            <FormField label="Documento fuente">
              <Select disabled={saving} value={payload.sourceDocumentType} onChange={(event) => selectSource(event.target.value)}>
                {sourceOptions.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Cuenta debito" required>
              <Select
                disabled={saving}
                value={payload.debitAccountId}
                onChange={(event) => setPayload((current) => ({ ...current, debitAccountId: event.target.value }))}
              >
                <option value="">Seleccionar</option>
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {accountLabel(account)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Cuenta credito" required>
              <Select
                disabled={saving}
                value={payload.creditAccountId}
                onChange={(event) => setPayload((current) => ({ ...current, creditAccountId: event.target.value }))}
              >
                <option value="">Seleccionar</option>
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {accountLabel(account)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Cuenta impuesto">
              <Select
                disabled={saving}
                value={payload.taxAccountId ?? ""}
                onChange={(event) => setPayload((current) => ({ ...current, taxAccountId: event.target.value || null }))}
              >
                <option value="">Sin impuesto</option>
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {accountLabel(account)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Prioridad">
              <Input
                disabled={saving}
                min={1}
                max={9999}
                type="number"
                value={payload.priority}
                onChange={(event) => setPayload((current) => ({ ...current, priority: Number(event.target.value) }))}
              />
            </FormField>
            <FormField label="Descripcion">
              <Textarea
                disabled={saving}
                value={payload.description ?? ""}
                onChange={(event) => setPayload((current) => ({ ...current, description: event.target.value }))}
              />
            </FormField>
            <FormField label="Aplica impuesto">
              <Checkbox
                checked={payload.appliesTax}
                disabled={saving}
                onChange={(event) => setPayload((current) => ({ ...current, appliesTax: event.target.checked }))}
              />
            </FormField>
            <FormField label="Predeterminada">
              <Checkbox
                checked={payload.isDefault}
                disabled={saving}
                onChange={(event) => setPayload((current) => ({ ...current, isDefault: event.target.checked }))}
              />
            </FormField>
            <Button disabled={saving} type="submit" variant="secondary">
              {editingId ? "Actualizar" : "Crear"}
            </Button>
            {editingId ? (
              <Button
                disabled={saving}
                onClick={() => {
                  setEditingId(null);
                  setPayload(defaultPayload);
                }}
                type="button"
                variant="ghost"
              >
                Cancelar
              </Button>
            ) : null}
          </FilterBar>
        </form>
      </Card>

      {loading ? (
        <LoadingState label="Cargando reglas contables..." />
      ) : feedback?.tone === "error" && rules.length === 0 ? (
        <ErrorState title="No se pudieron cargar" message={feedback.message} />
      ) : rules.length === 0 ? (
        <EmptyState title="Sin reglas" description="Crea la primera regla para parametrizar el motor contable." />
      ) : (
        <Card>
          <Table
            columns={["Codigo", "Fuente", "Direccion", "Debito", "Credito", "Impuesto", "Prioridad", "Estado", "Acciones"]}
            rows={rules.map((rule) => [
              rule.ruleCode,
              rule.sourceDocumentType,
              rule.direction === "RECEIVABLE" ? "Cobrar" : "Pagar",
              accountLabel(accountById.get(rule.debitAccountId)) || `${rule.debitAccountCode} ${rule.debitAccountName}`,
              accountLabel(accountById.get(rule.creditAccountId)) || `${rule.creditAccountCode} ${rule.creditAccountName}`,
              rule.taxAccountId ? accountLabel(accountById.get(rule.taxAccountId)) || `${rule.taxAccountCode} ${rule.taxAccountName}` : "No aplica",
              String(rule.priority),
              rule.isActive ? "Activa" : "Inactiva",
              <div className="table-actions">
                <Button
                  disabled={saving}
                  onClick={() => {
                    setEditingId(rule.postingRuleId);
                    setPayload(rulePayloadFrom(rule));
                  }}
                  type="button"
                  variant="ghost"
                >
                  Editar
                </Button>
                <Button disabled={saving || !rule.isActive} onClick={() => deactivate(rule)} type="button" variant="danger">
                  Desactivar
                </Button>
              </div>
            ])}
          />
        </Card>
      )}
    </div>
  );
}
