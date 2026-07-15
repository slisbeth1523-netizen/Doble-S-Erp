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
import {
  closeAccountingPeriod,
  createAccountingPeriod,
  listAccountingPeriods,
  reopenAccountingPeriod,
  updateAccountingPeriod,
  type AccountingPeriod,
  type AccountingPeriodPayload
} from "../../services/accountingPeriodsClient.js";
import { statusLabel } from "../../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const emptyForm: AccountingPeriodPayload = {
  fiscalYear: 2026,
  periodNumber: 1,
  name: "",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  isAdjustmentPeriod: false
};

function dateOnly(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function badgeTone(status: string) {
  return status === "OPEN" ? "green" : "amber";
}

export function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selected, setSelected] = useState<AccountingPeriod | null>(null);
  const [form, setForm] = useState<AccountingPeriodPayload>(emptyForm);
  const [search, setSearch] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadPeriods() {
    try {
      setLoading(true);
      const result = await listAccountingPeriods({
        search,
        fiscalYear,
        status,
        page: 1,
        pageSize: 50
      });
      setPeriods(result.records);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar periodos contables."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  function resetForm() {
    setSelected(null);
    setForm(emptyForm);
  }

  function selectPeriod(period: AccountingPeriod) {
    setSelected(period);
    setForm({
      fiscalYear: period.fiscalYear,
      periodNumber: period.periodNumber,
      name: period.name,
      startDate: dateOnly(period.startDate),
      endDate: dateOnly(period.endDate),
      isAdjustmentPeriod: period.isAdjustmentPeriod
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setFeedback({ tone: "warning", message: "El nombre del periodo es obligatorio." });
      return;
    }

    try {
      setSubmitting(true);
      const saved = selected
        ? await updateAccountingPeriod(selected.accountingPeriodId, form)
        : await createAccountingPeriod(form);

      setFeedback({
        tone: "success",
        message: selected ? "Periodo actualizado correctamente." : "Periodo creado correctamente."
      });
      setSelected(saved);
      await loadPeriods();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar el periodo."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(period: AccountingPeriod) {
    if (!confirm(`Cerrar el periodo ${period.displayCode}?`)) {
      return;
    }

    try {
      setSubmitting(true);
      const closed = await closeAccountingPeriod(period.accountingPeriodId);
      setSelected(closed);
      setFeedback({ tone: "success", message: "Periodo cerrado correctamente." });
      await loadPeriods();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cerrar el periodo."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopen(period: AccountingPeriod) {
    const reason = prompt("Motivo de reapertura");
    if (!reason?.trim()) {
      setFeedback({ tone: "warning", message: "Indica un motivo para reabrir el periodo." });
      return;
    }

    try {
      setSubmitting(true);
      const reopened = await reopenAccountingPeriod(period.accountingPeriodId, reason.trim());
      setSelected(reopened);
      setFeedback({ tone: "success", message: "Periodo reabierto correctamente." });
      await loadPeriods();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo reabrir el periodo."
      });
    } finally {
      setSubmitting(false);
    }
  }

  const rows = useMemo(
    () =>
      periods.map((period) => [
        period.displayCode,
        period.name,
        dateOnly(period.startDate),
        dateOnly(period.endDate),
        <Badge key={`${period.accountingPeriodId}-status`} tone={badgeTone(period.status)}>
          {statusLabel(period.status)}
        </Badge>,
        period.isAdjustmentPeriod ? "Si" : "No",
        period.openedAt ? dateOnly(period.openedAt) : "",
        period.closedAt ? dateOnly(period.closedAt) : "",
        period.reopenedAt ? dateOnly(period.reopenedAt) : "",
        <div key={`${period.accountingPeriodId}-actions`} className="table-actions">
          <Button onClick={() => selectPeriod(period)} type="button" variant="secondary">
            Ver
          </Button>
          {period.status === "OPEN" ? (
            <Button disabled={submitting} onClick={() => handleClose(period)} type="button" variant="ghost">
              Cerrar
            </Button>
          ) : (
            <Button disabled={submitting} onClick={() => handleReopen(period)} type="button" variant="ghost">
              Reabrir
            </Button>
          )}
        </div>
      ]),
    [periods, submitting]
  );

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Contabilidad"
        title="Periodos contables"
        description="Administra los rangos habilitados para movimientos contables por compania."
        actions={
          <Button onClick={resetForm} type="button" variant="secondary">
            Nuevo periodo
          </Button>
        }
      />

      {feedback ? (
        <Alert tone={feedback.tone === "success" ? "success" : feedback.tone === "warning" ? "warning" : "error"}>
          {feedback.message}
        </Alert>
      ) : null}

      <FilterBar>
        <FormField label="Buscar">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o codigo" />
        </FormField>
        <FormField label="Ano fiscal">
          <Input value={fiscalYear} onChange={(event) => setFiscalYear(event.target.value)} placeholder="2026" />
        </FormField>
        <FormField label="Estado">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="OPEN">Abierto</option>
            <option value="CLOSED">Cerrado</option>
          </Select>
        </FormField>
        <Button onClick={loadPeriods} type="button" variant="secondary">
          Aplicar
        </Button>
      </FilterBar>

      {loading ? (
        <LoadingState label="Cargando periodos..." />
      ) : periods.length === 0 ? (
        <EmptyState title="Sin periodos" description="No hay periodos contables con los filtros actuales." />
      ) : (
        <Table
          columns={[
            "Codigo",
            "Nombre",
            "Inicio",
            "Final",
            "Estado",
            "Ajuste",
            "Apertura",
            "Cierre",
            "Reapertura",
            "Acciones"
          ]}
          rows={rows}
        />
      )}

      <Card>
        <form onSubmit={handleSubmit}>
          <FormSection title={selected ? "Editar periodo" : "Nuevo periodo"}>
            {selected?.status === "CLOSED" ? (
              <ErrorState
                title="Periodo cerrado"
                message="Los periodos cerrados no pueden editarse; reabre con motivo para modificar campos."
              />
            ) : null}
            <FormField label="Ano fiscal" required>
              <Input
                min={1900}
                max={2200}
                type="number"
                value={form.fiscalYear}
                onChange={(event) => setForm((current) => ({ ...current, fiscalYear: Number(event.target.value) }))}
              />
            </FormField>
            <FormField label="Numero" required>
              <Input
                min={1}
                type="number"
                value={form.periodNumber}
                onChange={(event) => setForm((current) => ({ ...current, periodNumber: Number(event.target.value) }))}
              />
            </FormField>
            <FormField label="Nombre" required>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </FormField>
            <FormField label="Fecha inicial" required>
              <Input value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} type="date" />
            </FormField>
            <FormField label="Fecha final" required>
              <Input value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} type="date" />
            </FormField>
            <FormField label="Periodo de ajuste">
              <Select
                value={form.isAdjustmentPeriod ? "true" : "false"}
                onChange={(event) => setForm((current) => ({ ...current, isAdjustmentPeriod: event.target.value === "true" }))}
              >
                <option value="false">No</option>
                <option value="true">Si</option>
              </Select>
            </FormField>
            <div className="form-actions">
              <Button disabled={submitting || selected?.status === "CLOSED"} type="submit">
                {selected ? "Guardar cambios" : "Crear periodo"}
              </Button>
              <Button onClick={resetForm} type="button" variant="ghost">
                Limpiar
              </Button>
            </div>
          </FormSection>
        </form>
      </Card>
    </div>
  );
}
