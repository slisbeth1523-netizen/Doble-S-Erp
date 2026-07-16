import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  FormField,
  FormSection,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Table
} from "../../components/ui/index.js";
import { fetchCatalogLookup } from "../../modules/runtime-ui/services/metadataClient.js";
import type { LookupOption } from "../../modules/runtime-ui/types/runtime-ui.types.js";
import { listAccountingAccounts, type AccountingAccount } from "../../services/accountingAccountsClient.js";
import {
  addJournalEntryLine,
  createJournalEntry,
  deleteJournalEntryLine,
  getJournalEntry,
  listJournalEntries,
  postJournalEntry,
  updateJournalEntry,
  updateJournalEntryLine,
  type JournalEntry,
  type JournalEntryLine,
  type JournalEntryLinePayload,
  type JournalEntryPayload
} from "../../services/journalEntriesClient.js";
import { statusLabel } from "../../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const emptyEntry: JournalEntryPayload = {
  entryDate: "2025-02-15",
  description: "",
  reference: "",
  currencyCode: "DOP",
  exchangeRate: 1
};

const emptyLine: JournalEntryLinePayload = {
  accountId: "",
  costCenterId: "",
  description: "",
  debitAmount: 0,
  creditAmount: 0,
  reference: ""
};

function dateOnly(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function money(value: number | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function badgeTone(status: string) {
  return status === "POSTED" ? "green" : "amber";
}

function keyForPost(entryId: string) {
  return `journal-post-${entryId}`;
}

function currentPostKey(entryId: string) {
  const storageKey = keyForPost(entryId);
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  const next = `${entryId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(storageKey, next);
  return next;
}

export function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [entryForm, setEntryForm] = useState<JournalEntryPayload>(emptyEntry);
  const [lineForm, setLineForm] = useState<JournalEntryLinePayload>(emptyLine);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [costCenters, setCostCenters] = useState<LookupOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadEntries() {
    try {
      setLoading(true);
      const result = await listJournalEntries({ search, status, pageSize: 50 });
      setEntries(result.records);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar asientos contables."
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadReferences() {
    try {
      const [accountResult, costCenterResult] = await Promise.all([
        listAccountingAccounts({ pageSize: 300 }),
        fetchCatalogLookup("cost-centers", { pageSize: 100 })
      ]);
      setAccounts(
        accountResult.records.filter(
          (account) => account.isActive && account.allowsPosting && !account.isBlocked && account.childCount === 0
        )
      );
      setCostCenters(costCenterResult.filter((costCenter) => costCenter.isActive !== false));
    } catch (error) {
      setFeedback({
        tone: "warning",
        message: error instanceof Error ? error.message : "No se pudieron cargar cuentas o centros de costo."
      });
    }
  }

  useEffect(() => {
    loadEntries();
    loadReferences();
  }, []);

  function resetEntry() {
    setSelected(null);
    setEntryForm(emptyEntry);
    setLineForm(emptyLine);
    setEditingLineId(null);
  }

  async function selectEntry(entry: JournalEntry) {
    try {
      setSubmitting(true);
      const detail = await getJournalEntry(entry.journalEntryId);
      setSelected(detail);
      setEntryForm({
        entryDate: dateOnly(detail.entryDate),
        description: detail.description,
        reference: detail.reference ?? "",
        currencyCode: detail.currencyCode,
        exchangeRate: Number(detail.exchangeRate)
      });
      setLineForm(emptyLine);
      setEditingLineId(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo consultar el asiento."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEntrySubmit(event: FormEvent) {
    event.preventDefault();
    if (!entryForm.description.trim()) {
      setFeedback({ tone: "warning", message: "La descripcion es obligatoria." });
      return;
    }

    try {
      setSubmitting(true);
      const saved = selected
        ? await updateJournalEntry(selected.journalEntryId, entryForm)
        : await createJournalEntry(entryForm);
      setSelected(saved);
      setFeedback({ tone: "success", message: selected ? "Asiento actualizado." : "Asiento DRAFT creado." });
      await loadEntries();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar el asiento."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLineSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setFeedback({ tone: "warning", message: "Selecciona o crea un asiento primero." });
      return;
    }

    const account = accounts.find((item) => item.accountId === lineForm.accountId);
    if (account?.requiresCostCenter && !lineForm.costCenterId) {
      setFeedback({ tone: "warning", message: "La cuenta seleccionada requiere centro de costo." });
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...lineForm, costCenterId: lineForm.costCenterId || undefined };
      const saved = editingLineId
        ? await updateJournalEntryLine(selected.journalEntryId, editingLineId, payload)
        : await addJournalEntryLine(selected.journalEntryId, payload);
      setSelected(saved);
      setLineForm(emptyLine);
      setEditingLineId(null);
      setFeedback({ tone: "success", message: editingLineId ? "Linea actualizada." : "Linea agregada." });
      await loadEntries();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar la linea."
      });
    } finally {
      setSubmitting(false);
    }
  }

  function editLine(line: JournalEntryLine) {
    setEditingLineId(line.journalEntryLineId);
    setLineForm({
      accountId: line.accountId,
      costCenterId: line.costCenterId ?? "",
      description: line.description,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      reference: line.reference ?? ""
    });
  }

  async function removeLine(line: JournalEntryLine) {
    if (!selected || !confirm(`Eliminar la linea ${line.lineNumber}?`)) {
      return;
    }

    try {
      setSubmitting(true);
      const saved = await deleteJournalEntryLine(selected.journalEntryId, line.journalEntryLineId);
      setSelected(saved);
      setFeedback({ tone: "success", message: "Linea eliminada." });
      await loadEntries();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo eliminar la linea."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost() {
    if (!selected) {
      return;
    }

    try {
      setSubmitting(true);
      const saved = await postJournalEntry(selected.journalEntryId, currentPostKey(selected.journalEntryId));
      setSelected(saved);
      window.sessionStorage.removeItem(keyForPost(selected.journalEntryId));
      setFeedback({ tone: "success", message: "Asiento posteado correctamente." });
      await loadEntries();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo postear el asiento."
      });
    } finally {
      setSubmitting(false);
    }
  }

  const entryRows = useMemo(
    () =>
      entries.map((entry) => [
        entry.entryNumber,
        dateOnly(entry.entryDate),
        entry.periodCode,
        entry.description,
        <Badge key={`${entry.journalEntryId}-status`} tone={badgeTone(entry.status)}>
          {statusLabel(entry.status)}
        </Badge>,
        money(entry.totalDebit),
        money(entry.totalCredit),
        money(entry.difference),
        <Button key={`${entry.journalEntryId}-view`} onClick={() => selectEntry(entry)} type="button" variant="secondary">
          Ver
        </Button>
      ]),
    [entries]
  );

  const lineRows = useMemo(
    () =>
      (selected?.lines ?? []).map((line) => [
        line.lineNumber,
        `${line.accountCode} ${line.accountName}`,
        line.costCenterCode ?? "",
        line.description,
        money(line.debitAmount),
        money(line.creditAmount),
        selected?.status === "DRAFT" ? (
          <div key={`${line.journalEntryLineId}-actions`} className="table-actions">
            <Button disabled={submitting} onClick={() => editLine(line)} type="button" variant="secondary">
              Editar
            </Button>
            <Button disabled={submitting} onClick={() => removeLine(line)} type="button" variant="ghost">
              Eliminar
            </Button>
          </div>
        ) : (
          "Solo consulta"
        )
      ]),
    [selected, submitting]
  );

  const selectedAccount = accounts.find((account) => account.accountId === lineForm.accountId);
  const canEdit = selected?.status !== "POSTED";

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Contabilidad"
        title="Asientos contables"
        description="Registra asientos manuales, valida balance y postea en una transaccion controlada."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/master-data/journal-entries">
              Consulta asientos
            </a>
            <Button onClick={resetEntry} type="button" variant="secondary">
              Nuevo asiento
            </Button>
          </div>
        }
      />

      {feedback ? (
        <Alert tone={feedback.tone} title={feedback.tone === "error" ? "Atencion" : undefined}>
          {feedback.message}
        </Alert>
      ) : null}

      <FilterBar>
        <FormField label="Buscar">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Numero, descripcion o referencia" />
        </FormField>
        <FormField label="Estado">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="POSTED">Posteado</option>
          </Select>
        </FormField>
        <Button onClick={loadEntries} type="button" variant="secondary">
          Filtrar
        </Button>
      </FilterBar>

      {loading ? (
        <LoadingState label="Cargando asientos..." />
      ) : entries.length === 0 ? (
        <EmptyState title="Sin asientos" description="Crea el primer asiento manual en DRAFT." />
      ) : (
        <Card>
          <Table
            columns={["Numero", "Fecha", "Periodo", "Descripcion", "Estado", "Debito", "Credito", "Diferencia", ""]}
            rows={entryRows}
          />
        </Card>
      )}

      <div className="runtime-grid">
        <Card>
          <form onSubmit={handleEntrySubmit}>
            <FormSection
              title={selected ? `Encabezado ${selected.entryNumber}` : "Nuevo encabezado"}
              description={selected?.periodCode ? `Periodo detectado: ${selected.periodCode}` : "El periodo se detecta automaticamente por fecha."}
            >
              <FormField label="Fecha" required>
                <Input
                  disabled={!canEdit || submitting}
                  type="date"
                  value={entryForm.entryDate}
                  onChange={(event) => setEntryForm((current) => ({ ...current, entryDate: event.target.value }))}
                />
              </FormField>
              <FormField label="Descripcion" required>
                <Input
                  disabled={!canEdit || submitting}
                  value={entryForm.description}
                  onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))}
                />
              </FormField>
              <FormField label="Referencia">
                <Input
                  disabled={!canEdit || submitting}
                  value={entryForm.reference}
                  onChange={(event) => setEntryForm((current) => ({ ...current, reference: event.target.value }))}
                />
              </FormField>
              <FormField label="Moneda" required>
                <Input
                  disabled={!canEdit || submitting}
                  maxLength={3}
                  value={entryForm.currencyCode}
                  onChange={(event) => setEntryForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
                />
              </FormField>
              <FormField label="Tasa" required>
                <Input
                  disabled={!canEdit || submitting}
                  min="0.000001"
                  step="0.000001"
                  type="number"
                  value={entryForm.exchangeRate}
                  onChange={(event) => setEntryForm((current) => ({ ...current, exchangeRate: Number(event.target.value) }))}
                />
              </FormField>
              <div className="table-actions">
                <Button disabled={!canEdit || submitting} type="submit">
                  {selected ? "Actualizar" : "Crear DRAFT"}
                </Button>
                {selected ? (
                  <Button disabled={!selected.canPost || submitting} onClick={handlePost} type="button" variant="secondary">
                    Postear
                  </Button>
                ) : null}
              </div>
            </FormSection>
          </form>
        </Card>

        <Card>
          <FormSection title="Totales" description="Los importes se recalculan en backend.">
            <Table
              columns={["Debito", "Credito", "Diferencia", "Debito base", "Credito base", "Balance"]}
              rows={[
                [
                  money(selected?.totalDebit),
                  money(selected?.totalCredit),
                  money(selected?.difference),
                  money(selected?.totalDebitBase),
                  money(selected?.totalCreditBase),
                  selected?.isBalanced ? "Balanceado" : "Pendiente"
                ]
              ]}
            />
          </FormSection>
        </Card>
      </div>

      {selected ? (
        <Card>
          <form onSubmit={handleLineSubmit}>
            <FormSection
              title={editingLineId ? "Editar linea" : "Agregar linea"}
              description={selected.status === "POSTED" ? "Asiento posteado en modo solo consulta." : "Selecciona cuenta, centro y monto debito o credito."}
            >
              <FormField label="Cuenta" required>
                <Select
                  disabled={!canEdit || submitting}
                  value={lineForm.accountId}
                  onChange={(event) => setLineForm((current) => ({ ...current, accountId: event.target.value }))}
                >
                  <option value="">Seleccionar</option>
                  {accounts.map((account) => (
                    <option key={account.accountId} value={account.accountId}>
                      {account.code} {account.name}
                      {account.requiresCostCenter ? " - requiere centro" : ""}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Centro de costo" required={selectedAccount?.requiresCostCenter}>
                <Select
                  disabled={!canEdit || submitting}
                  value={lineForm.costCenterId}
                  onChange={(event) => setLineForm((current) => ({ ...current, costCenterId: event.target.value }))}
                >
                  <option value="">Sin centro</option>
                  {costCenters.map((costCenter) => (
                    <option key={costCenter.value} value={costCenter.value}>
                      {costCenter.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Descripcion" required>
                <Input
                  disabled={!canEdit || submitting}
                  value={lineForm.description}
                  onChange={(event) => setLineForm((current) => ({ ...current, description: event.target.value }))}
                />
              </FormField>
              <FormField label="Debito">
                <Input
                  disabled={!canEdit || submitting}
                  min="0"
                  step="0.0001"
                  type="number"
                  value={lineForm.debitAmount}
                  onChange={(event) => setLineForm((current) => ({ ...current, debitAmount: Number(event.target.value) }))}
                />
              </FormField>
              <FormField label="Credito">
                <Input
                  disabled={!canEdit || submitting}
                  min="0"
                  step="0.0001"
                  type="number"
                  value={lineForm.creditAmount}
                  onChange={(event) => setLineForm((current) => ({ ...current, creditAmount: Number(event.target.value) }))}
                />
              </FormField>
              <FormField label="Referencia">
                <Input
                  disabled={!canEdit || submitting}
                  value={lineForm.reference}
                  onChange={(event) => setLineForm((current) => ({ ...current, reference: event.target.value }))}
                />
              </FormField>
              <div className="table-actions">
                <Button disabled={!canEdit || submitting} type="submit">
                  {editingLineId ? "Actualizar linea" : "Agregar linea"}
                </Button>
                {editingLineId ? (
                  <Button disabled={submitting} onClick={() => { setEditingLineId(null); setLineForm(emptyLine); }} type="button" variant="ghost">
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </FormSection>
          </form>

          <Table
            columns={["Linea", "Cuenta", "Centro", "Descripcion", "Debito", "Credito", "Acciones"]}
            rows={lineRows}
          />
        </Card>
      ) : (
        <ErrorState title="Asiento no seleccionado" message="Crea o selecciona un asiento para administrar sus lineas." />
      )}
    </div>
  );
}
