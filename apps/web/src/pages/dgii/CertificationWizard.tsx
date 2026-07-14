import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Alert, Badge, Button, Card, Input, LoadingState, PageHeader, Select } from "../../components/ui/index.js";
import {
  generateCertificationAffidavit,
  generateCertificationApplication,
  getCertificationProfile,
  getCertificationSteps,
  getTaxConfig,
  resetCertification,
  runCertificationStep,
  saveCertificationProfile,
  saveFullTaxConfig,
  updateCertificationStep,
  type CertificationProfile,
  type CertificationStep,
  type CompanyTaxConfig
} from "../../services/dgiiClient.js";
import { statusLabel } from "../../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

type TaxForm = {
  rnc: string;
  fiscalName: string;
  environment: "TESTECF" | "CERTECF" | "PRODUCCION";
  certificateAlias: string;
  certificateFileName: string;
  certificateBase64: string;
};

const phaseLabels: Record<string, string> = {
  POSTULACION: "Postulacion",
  PREPARACION: "Preparacion tecnica",
  DATOS_ECF: "Pruebas e-CF",
  RECEPCION: "Recepcion y aprobacion",
  PRODUCCION: "Paso a produccion"
};

const applicationStatusLabels: Record<string, string> = {
  NOT_STARTED: "No iniciada",
  READY_TO_APPLY: "Lista para postular",
  SUBMITTED: "Postulada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  ON_HOLD: "En espera"
};

const environmentLabels: Record<TaxForm["environment"], string> = {
  TESTECF: "Prueba / Pre-certificacion",
  CERTECF: "Certificacion DGII",
  PRODUCCION: "Produccion"
};

const statusTone: Record<string, "green" | "amber" | "red" | "neutral"> = {
  PASSED: "green",
  RUNNING: "amber",
  FAILED: "red",
  PENDING: "neutral"
};

const defaultTaxForm: TaxForm = {
  rnc: "",
  fiscalName: "",
  environment: "TESTECF",
  certificateAlias: "",
  certificateFileName: "",
  certificateBase64: ""
};

function emptyProfile(): CertificationProfile {
  return {
    id: "",
    applicationStatus: "NOT_STARTED",
    printedRepresentationStatus: "PENDING",
    productionAuthorizationStatus: "PENDING",
    softwareName: "Doble S ERP",
    softwareVersion: "1.0",
    taxpayerType: "PERSONA_JURIDICA"
  };
}

function mapTaxForm(config: CompanyTaxConfig | null | undefined): TaxForm {
  return {
    rnc: config?.Rnc ?? "",
    fiscalName: config?.FiscalName ?? "",
    environment: (config?.Environment as TaxForm["environment"]) ?? "TESTECF",
    certificateAlias: config?.CertificateAlias ?? "",
    certificateFileName: config?.CertificateFileName ?? "",
    certificateBase64: ""
  };
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] ?? "" : value);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function environmentPortalUrl(environment: TaxForm["environment"]) {
  if (environment === "PRODUCCION") return "https://ecf.dgii.gov.do/ecf";
  if (environment === "CERTECF") return "https://ecf.dgii.gov.do/certecf";
  return "https://ecf.dgii.gov.do/testecf";
}

export function CertificationWizard() {
  const [profile, setProfile] = useState<CertificationProfile>(emptyProfile);
  const [taxForm, setTaxForm] = useState<TaxForm>(defaultTaxForm);
  const [steps, setSteps] = useState<CertificationStep[]>([]);
  const [selectedStepNumber, setSelectedStepNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[SISTEMA] Asistente DGII listo.",
    "[SISTEMA] Carga certificado y logo; el ERP los convierte a Base64 y prepara la postulacion."
  ]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const selectedStep = steps.find((step) => step.stepNumber === selectedStepNumber) ?? steps[0];
  const completedCount = steps.filter((step) => step.status === "PASSED").length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const nextStep = steps.find((step) => step.status !== "PASSED") ?? steps[steps.length - 1];
  const hasSignedApplication = Boolean(profile.signedApplicationXml);
  const hasSignedAffidavit = Boolean(profile.signedAffidavitXml);

  const groupedSteps = useMemo(() => {
    return steps.reduce<Record<string, CertificationStep[]>>((groups, step) => {
      const phase = step.phaseCode ?? "DATOS_ECF";
      groups[phase] = [...(groups[phase] ?? []), step];
      return groups;
    }, {});
  }, [steps]);

  async function loadData() {
    try {
      const [profileResult, stepResult, configResult] = await Promise.all([
        getCertificationProfile(),
        getCertificationSteps(),
        getTaxConfig().catch(() => null)
      ]);
      setProfile({ ...emptyProfile(), ...(profileResult ?? {}) });
      setSteps(stepResult);
      setTaxForm(mapTaxForm(configResult));
      setSelectedStepNumber(stepResult[0]?.stepNumber ?? 1);
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el expediente DGII."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleCertificateUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const base64 = await readFileAsBase64(file);
    setTaxForm((current) => ({
      ...current,
      certificateFileName: file.name,
      certificateBase64: base64,
      certificateAlias: current.certificateAlias || file.name.replace(/\.(p12|pfx)$/i, "")
    }));
    setLogs((current) => [...current, `[ARCHIVO] Certificado ${file.name} convertido a Base64 (${base64.length} caracteres).`]);
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const base64 = await readFileAsBase64(file);
    setProfile((current) => ({
      ...current,
      logoFileName: file.name,
      logoMimeType: file.type || "image/png",
      logoBase64: base64
    }));
    setLogs((current) => [...current, `[ARCHIVO] Logo ${file.name} convertido a Base64 (${base64.length} caracteres).`]);
  }

  async function handleSaveTaxConfig(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const config = await saveFullTaxConfig({
        rnc: taxForm.rnc,
        fiscalName: taxForm.fiscalName,
        environment: taxForm.environment,
        certificateAlias: taxForm.certificateAlias || undefined,
        certificateFileName: taxForm.certificateFileName || undefined,
        certificateData: taxForm.certificateBase64 || undefined
      });
      setTaxForm((current) => ({
        ...current,
        certificateFileName: config.CertificateFileName ?? current.certificateFileName,
        certificateBase64: ""
      }));
      setFeedback({ tone: "success", message: "Configuracion fiscal y certificado guardados." });
      setLogs((current) => [...current, `[CONFIG] Ambiente activo: ${environmentLabels[taxForm.environment]}.`]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar la configuracion." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveCertificationProfile(profile);
      setProfile({ ...emptyProfile(), ...result });
      setFeedback({ tone: "success", message: "Expediente de certificacion actualizado." });
      setLogs((current) => [...current, "[EXPEDIENTE] Datos de postulacion, software, logo y URLs guardados."]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar el expediente." });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateApplication() {
    setSaving(true);
    setFeedback(null);
    try {
      await handleSaveTaxConfig();
      await handleSaveProfile();
      const result = await generateCertificationApplication();
      setProfile({ ...emptyProfile(), ...result.profile });
      setSteps(result.steps);
      setFeedback({ tone: "success", message: "Postulacion generada y firmada desde el ERP." });
      setLogs((current) => [...current, `[FIRMA] Postulacion firmada (${result.signedXml.length} caracteres).`]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo generar la postulacion." });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateAffidavit() {
    setSaving(true);
    setFeedback(null);
    try {
      await handleSaveTaxConfig();
      await handleSaveProfile();
      const result = await generateCertificationAffidavit();
      setProfile({ ...emptyProfile(), ...result.profile });
      setSteps(result.steps);
      setFeedback({ tone: "success", message: "Declaracion jurada generada y firmada desde el ERP." });
      setLogs((current) => [...current, `[FIRMA] Declaracion jurada firmada (${result.signedXml.length} caracteres).`]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo generar la declaracion jurada." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunStep(step = selectedStep) {
    if (!step) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await runCertificationStep(step.stepNumber);
      setSteps((current) => current.map((item) => (item.stepNumber === step.stepNumber ? result : item)));
      setFeedback({ tone: "success", message: `Paso ${step.stepNumber} marcado como aprobado.` });
      setLogs((current) => [...current, `[OK] Paso ${step.stepNumber}: ${step.description}.`]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo ejecutar el paso." });
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    if (!nextStep) return;
    setSelectedStepNumber(nextStep.stepNumber);
    if (nextStep.ecfType === "POSTULACION") {
      await handleGenerateApplication();
      return;
    }
    if (nextStep.ecfType === "DECLARACION") {
      await handleGenerateAffidavit();
      return;
    }
    if (nextStep.nature === "API" || nextStep.nature === "ERP") {
      await handleRunStep(nextStep);
      return;
    }
    if (nextStep.portalUrl) {
      window.open(nextStep.portalUrl, "_blank", "noopener,noreferrer");
    }
    await updateCertificationStep(nextStep.stepNumber, { status: "RUNNING" });
    setSteps(await getCertificationSteps());
  }

  async function handleSaveStep(event: FormEvent) {
    event.preventDefault();
    if (!selectedStep) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateCertificationStep(selectedStep.stepNumber, selectedStep);
      setSteps((current) => current.map((step) => (step.stepNumber === selectedStep.stepNumber ? result : step)));
      setFeedback({ tone: "success", message: "Evidencia del paso guardada." });
      setLogs((current) => [...current, `[EVIDENCIA] Paso ${selectedStep.stepNumber} actualizado.`]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar la evidencia." });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await resetCertification();
      setSteps(result);
      setFeedback({ tone: "warning", message: "Checklist de certificacion reiniciado." });
      setLogs((current) => [...current, "[SISTEMA] Checklist reiniciado."]);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo reiniciar el checklist." });
    } finally {
      setSaving(false);
    }
  }

  function updateSelectedStep(patch: Partial<CertificationStep>) {
    if (!selectedStep) return;
    setSteps((current) =>
      current.map((step) => (step.stepNumber === selectedStep.stepNumber ? { ...step, ...patch } : step))
    );
  }

  if (loading) {
    return <LoadingState label="Cargando certificacion DGII..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="DGII"
        title="Certificacion e-CF"
        description="Asistente operativo para postulacion, certificado digital, pruebas, declaracion jurada y paso a produccion."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      <div className="content-grid">
        <Card>
          <form className="settings-form" onSubmit={handleSaveTaxConfig}>
            <h2>Configuracion fiscal</h2>
            <div className="operation-form-row">
              <div className="runtime-field">
                <span>RNC</span>
                <Input value={taxForm.rnc} onChange={(event) => setTaxForm((current) => ({ ...current, rnc: event.target.value }))} disabled={saving} />
              </div>
              <div className="runtime-field">
                <span>Razon social</span>
                <Input value={taxForm.fiscalName} onChange={(event) => setTaxForm((current) => ({ ...current, fiscalName: event.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="operation-form-row">
              <div className="runtime-field">
                <span>Ambiente DGII</span>
                <Select value={taxForm.environment} onChange={(event) => setTaxForm((current) => ({ ...current, environment: event.target.value as TaxForm["environment"] }))} disabled={saving}>
                  <option value="TESTECF">Prueba / Pre-certificacion</option>
                  <option value="CERTECF">Certificacion</option>
                  <option value="PRODUCCION">Produccion</option>
                </Select>
              </div>
              <div className="runtime-field">
                <span>Alias del certificado</span>
                <Input value={taxForm.certificateAlias} onChange={(event) => setTaxForm((current) => ({ ...current, certificateAlias: event.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="runtime-field">
              <span>Certificado digital P12/PFX</span>
              <Input type="file" accept=".p12,.pfx" onChange={handleCertificateUpload} disabled={saving} />
              <small>{taxForm.certificateFileName ? `Archivo cargado: ${taxForm.certificateFileName}` : "Selecciona el certificado para convertirlo automaticamente a Base64."}</small>
            </div>
            <Button type="submit" disabled={saving} variant="primary">Guardar certificado y ambiente</Button>
          </form>
        </Card>

        <Card>
          <h2>Avance DGII</h2>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <strong>{completedCount} de {steps.length} pasos aprobados</strong>
            <strong>{progressPercent}%</strong>
          </div>
          <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden", marginBottom: "18px" }}>
            <div style={{ height: "100%", width: `${progressPercent}%`, background: "var(--primary)", transition: "width 0.3s ease" }} />
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <div><strong>Ambiente:</strong> {environmentLabels[taxForm.environment]}</div>
            <div><strong>Postulacion:</strong> {applicationStatusLabels[profile.applicationStatus] ?? profile.applicationStatus}</div>
            <div><strong>Postulacion firmada:</strong> {hasSignedApplication ? "Lista" : "Pendiente"}</div>
            <div><strong>Declaracion jurada:</strong> {hasSignedAffidavit ? "Lista" : "Pendiente"}</div>
          </div>
          <div style={{ marginTop: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button onClick={handleContinue} disabled={saving || !nextStep} variant="primary">Continuar siguiente paso</Button>
            <Button onClick={handleReset} disabled={saving} variant="secondary">Reiniciar checklist</Button>
          </div>
        </Card>
      </div>

      <Card>
        <form className="settings-form" onSubmit={handleSaveProfile}>
          <h2>Datos para postulacion DGII</h2>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Estado de postulacion</span>
              <Select value={profile.applicationStatus} onChange={(event) => setProfile((current) => ({ ...current, applicationStatus: event.target.value }))} disabled={saving}>
                {Object.entries(applicationStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="runtime-field">
              <span>Referencia / caso DGII</span>
              <Input value={profile.applicationReference ?? ""} onChange={(event) => setProfile((current) => ({ ...current, applicationReference: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Nombre comercial</span>
              <Input value={profile.commercialName ?? ""} onChange={(event) => setProfile((current) => ({ ...current, commercialName: event.target.value }))} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Actividad economica</span>
              <Input value={profile.economicActivity ?? ""} onChange={(event) => setProfile((current) => ({ ...current, economicActivity: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Tipo de contribuyente</span>
              <Select value={profile.taxpayerType ?? "PERSONA_JURIDICA"} onChange={(event) => setProfile((current) => ({ ...current, taxpayerType: event.target.value }))} disabled={saving}>
                <option value="PERSONA_JURIDICA">Persona juridica</option>
                <option value="PERSONA_FISICA">Persona fisica</option>
                <option value="INSTITUCION_PUBLICA">Institucion publica</option>
              </Select>
            </div>
            <div className="runtime-field">
              <span>Usuario portal certificacion</span>
              <Input value={profile.portalUser ?? ""} onChange={(event) => setProfile((current) => ({ ...current, portalUser: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Representante legal</span>
              <Input value={profile.representativeName ?? ""} onChange={(event) => setProfile((current) => ({ ...current, representativeName: event.target.value }))} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Documento representante</span>
              <Input value={profile.representativeDocument ?? ""} onChange={(event) => setProfile((current) => ({ ...current, representativeDocument: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Correo representante</span>
              <Input value={profile.representativeEmail ?? ""} onChange={(event) => setProfile((current) => ({ ...current, representativeEmail: event.target.value }))} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Telefono representante</span>
              <Input value={profile.representativePhone ?? ""} onChange={(event) => setProfile((current) => ({ ...current, representativePhone: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Contacto tecnico</span>
              <Input value={profile.technicalContactName ?? ""} onChange={(event) => setProfile((current) => ({ ...current, technicalContactName: event.target.value }))} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Correo tecnico</span>
              <Input value={profile.technicalContactEmail ?? ""} onChange={(event) => setProfile((current) => ({ ...current, technicalContactEmail: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Nombre del software</span>
              <Input value={profile.softwareName ?? ""} onChange={(event) => setProfile((current) => ({ ...current, softwareName: event.target.value }))} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Version del software</span>
              <Input value={profile.softwareVersion ?? ""} onChange={(event) => setProfile((current) => ({ ...current, softwareVersion: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="runtime-field">
            <span>RNC proveedor software</span>
            <Input value={profile.softwareProviderRnc ?? ""} onChange={(event) => setProfile((current) => ({ ...current, softwareProviderRnc: event.target.value }))} disabled={saving} />
          </div>
          <div className="runtime-field">
            <span>Logo para representacion impresa</span>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} disabled={saving} />
            {profile.logoBase64 && profile.logoMimeType && (
              <img
                alt="Logo emisor"
                src={`data:${profile.logoMimeType};base64,${profile.logoBase64}`}
                style={{ marginTop: "10px", maxHeight: "64px", maxWidth: "220px", objectFit: "contain" }}
              />
            )}
          </div>
          <Button type="submit" disabled={saving} variant="primary">Guardar expediente</Button>
        </form>
      </Card>

      <Card>
        <form className="settings-form" onSubmit={handleSaveProfile}>
          <h2>URLs y enlaces automaticos</h2>
          <div className="operation-form-row">
            <a className="button secondary" href="https://dgii.gov.do/ofv" target="_blank" rel="noreferrer">Oficina Virtual</a>
            <a className="button secondary" href={environmentPortalUrl(taxForm.environment)} target="_blank" rel="noreferrer">Portal del ambiente activo</a>
          </div>
          <div className="operation-form-row">
            <div className="runtime-field">
              <span>Recepcion e-CF</span>
              <Input value={profile.serviceReceptionUrl ?? ""} onChange={(event) => setProfile((current) => ({ ...current, serviceReceptionUrl: event.target.value }))} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Aprobacion comercial</span>
              <Input value={profile.serviceApprovalUrl ?? ""} onChange={(event) => setProfile((current) => ({ ...current, serviceApprovalUrl: event.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="runtime-field">
            <span>Autenticacion / semilla y token</span>
            <Input value={profile.serviceAuthenticationUrl ?? ""} onChange={(event) => setProfile((current) => ({ ...current, serviceAuthenticationUrl: event.target.value }))} disabled={saving} />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button type="submit" disabled={saving} variant="secondary">Guardar URLs</Button>
            <Button type="button" onClick={handleGenerateApplication} disabled={saving} variant="primary">Generar y firmar postulacion</Button>
            <Button type="button" onClick={handleGenerateAffidavit} disabled={saving} variant="secondary">Generar y firmar declaracion jurada</Button>
          </div>
        </form>
      </Card>

      <div className="content-grid">
        <Card>
          <h2>Checklist DGII</h2>
          <div style={{ display: "grid", gap: "18px" }}>
            {Object.entries(groupedSteps).map(([phase, phaseSteps]) => (
              <section key={phase}>
                <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>{phaseLabels[phase] ?? phase}</h3>
                <div style={{ display: "grid", gap: "8px" }}>
                  {phaseSteps.map((step) => (
                    <button
                      key={step.stepNumber}
                      type="button"
                      onClick={() => setSelectedStepNumber(step.stepNumber)}
                      style={{
                        border: selectedStepNumber === step.stepNumber ? "1px solid var(--primary)" : "1px solid var(--border)",
                        background: "var(--surface)",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px",
                        textAlign: "left",
                        color: "var(--text)",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                        <strong>{step.stepNumber}. {step.ecfType}</strong>
                        <Badge tone={statusTone[step.status] ?? "neutral"}>{statusLabel(step.status)}</Badge>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "4px" }}>{step.description}</div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <Card>
          {selectedStep ? (
            <form className="settings-form" onSubmit={handleSaveStep}>
              <h2>Paso {selectedStep.stepNumber}: {selectedStep.ecfType}</h2>
              <p style={{ color: "var(--muted)", marginTop: 0 }}>{selectedStep.description}</p>
              <div className="operation-form-row">
                <div className="runtime-field">
                  <span>Estado</span>
                  <Select value={selectedStep.status} onChange={(event) => updateSelectedStep({ status: event.target.value })} disabled={saving}>
                    <option value="PENDING">Pendiente</option>
                    <option value="RUNNING">En ejecucion</option>
                    <option value="PASSED">Aprobado</option>
                    <option value="FAILED">Fallido</option>
                  </Select>
                </div>
                <div className="runtime-field">
                  <span>Responsable</span>
                  <Input value={selectedStep.responsibleName ?? ""} onChange={(event) => updateSelectedStep({ responsibleName: event.target.value })} disabled={saving} />
                </div>
              </div>
              <div className="runtime-field">
                <span>Enlace de evidencia</span>
                <Input value={selectedStep.evidenceUrl ?? ""} onChange={(event) => updateSelectedStep({ evidenceUrl: event.target.value })} disabled={saving} />
              </div>
              <div className="runtime-field">
                <span>Respuesta DGII / resultado</span>
                <Input value={selectedStep.response ?? ""} onChange={(event) => updateSelectedStep({ response: event.target.value })} disabled={saving} />
              </div>
              <div className="runtime-field">
                <span>Notas</span>
                <Input value={selectedStep.notes ?? ""} onChange={(event) => updateSelectedStep({ notes: event.target.value })} disabled={saving} />
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Button type="submit" disabled={saving} variant="primary">Guardar paso</Button>
                <Button type="button" onClick={() => handleRunStep()} disabled={saving} variant="secondary">Ejecutar / aprobar</Button>
                {selectedStep.portalUrl && (
                  <a className="button secondary" href={selectedStep.portalUrl} target="_blank" rel="noreferrer">Abrir DGII</a>
                )}
              </div>
            </form>
          ) : (
            <p>Selecciona un paso para editarlo.</p>
          )}
        </Card>
      </div>

      <Card>
        <h2>Consola de certificacion</h2>
        <div style={{
          background: "#090d16",
          border: "1px solid var(--border)",
          padding: "16px",
          borderRadius: "var(--radius-sm)",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#4ade80",
          height: "180px",
          overflowY: "auto"
        }}>
          {logs.map((log, index) => (
            <div key={`${log}-${index}`} style={{ marginBottom: "4px" }}>{log}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </Card>
    </div>
  );
}
