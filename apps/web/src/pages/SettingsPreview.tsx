import {
  Alert,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea
} from "../components/ui/index.js";

export function SettingsPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        description="Preferencias visuales y contexto de trabajo preparados como vista previa."
        eyebrow="Configuración"
        title="Configuración"
      />
      <Alert>El tema claro/oscuro queda preparado por tokens CSS; esta pantalla no persiste preferencias.</Alert>
      <Card className="settings-form">
        <label>
          <span>Empresa actual</span>
          <Input readOnly value="Empresa actual" />
        </label>
        <label>
          <span>Tema preferido</span>
          <Select defaultValue="system">
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
            <option value="system">Sistema</option>
          </Select>
        </label>
        <label className="checkbox-row">
          <Checkbox defaultChecked />
          <span>Usar modo vista de desarrollo</span>
        </label>
        <label>
          <span>Notas</span>
          <Textarea placeholder="Notas locales de validación visual" />
        </label>
      </Card>
      <Card>
        <h2>Estados de UX</h2>
        <div className="state-demo">
          <LoadingState label="Cargando preferencias..." />
          <ErrorState title="Preferencias no guardadas" message="No hay persistencia activa en esta vista previa." />
          <EmptyState title="Sin configuraciones reales" description="Las opciones son placeholders visuales." />
        </div>
      </Card>
    </div>
  );
}
