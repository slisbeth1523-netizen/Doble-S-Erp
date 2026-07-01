# Tarea para Codex - Fase 3.1 Master Data Runtime

## Repositorio objetivo

Trabaja unicamente sobre:

```text
slisbeth1523-netizen/Doble-S-Erp
```

No crear repositorio nuevo. No trabajar sobre forks. No hacer merge directo a main.

## Objetivo

Implementar la Fase 3.1: Master Data Runtime.

Esta fase extiende el Master Data Engine para entregar metadata, lookups, validaciones runtime, acciones y contratos de import/export para catalogos maestros.

No implementar clientes, proveedores, productos, inventario, compras, ventas, facturacion ni DGII.

## Leer antes de programar

- `README.md`
- `docs/phases/PHASE_1_3_CORE_FRAMEWORK.md`
- `docs/phases/PHASE_2_ENTERPRISE_SECURITY.md`
- `docs/phases/PHASE_2_1_SECURITY_ENGINE_NAVIGATION_LICENSES.md`
- `docs/phases/PHASE_3_0_MASTER_DATA_ENGINE.md`
- `docs/phases/PHASE_3_1_MASTER_DATA_RUNTIME.md`

## Crear rama

Crear una rama nueva:

```text
feature/phase-3-1-master-data-runtime
```

Abrir Pull Request al finalizar.

Titulo sugerido:

```text
feat: phase 3.1 master data runtime
```

No hacer merge.

## Instruccion principal

Implementa la infraestructura definida en `docs/phases/PHASE_3_1_MASTER_DATA_RUNTIME.md` respetando la arquitectura existente.

No duplicar helpers existentes.
No crear pantallas completas.
No crear modulos funcionales fuera del alcance.

## Alcance obligatorio

### 1. Extender CatalogDefinition

Agregar metadata de campos:

- field
- label
- type
- required
- visibleInGrid
- visibleInForm
- searchable
- sortable
- editable
- readOnly
- defaultValue opcional
- placeholder opcional
- helpText opcional
- displayOrder

Agregar validation metadata:

- required
- minLength
- maxLength
- min
- max
- regex
- unique
- nullable

### 2. Endpoint de metadata

Crear:

```text
GET /api/master-data/:catalog/metadata
```

Debe devolver definicion usable por frontend:

- catalogo
- campos
- grid
- form
- validaciones
- acciones disponibles
- permisos requeridos
- licencia requerida si aplica
- feature flag requerido si aplica

### 3. Lookup Engine

Crear:

```text
GET /api/master-data/:catalog/lookup
```

Debe devolver:

```ts
{
  value: string;
  label: string;
  code?: string;
  isActive?: boolean;
}
```

Debe soportar:

- search
- page
- pageSize
- solo activos por defecto
- seguridad y permisos existentes

### 4. Grid Runtime

Agregar configuracion de grid dentro de metadata:

- columnas visibles
- orden
- ancho sugerido
- alineacion
- formato
- sortable
- searchable

### 5. Form Runtime

Agregar configuracion de formulario dentro de metadata:

- campos visibles
- orden
- tipo input
- required
- readOnly
- placeholder
- helpText
- validaciones

### 6. Import/Export Contracts

Crear contratos o endpoints seguros:

```text
GET /api/master-data/:catalog/export-template
POST /api/master-data/:catalog/import-preview
```

Si no se implementa procesamiento real, responder JSON controlado indicando que esta preparado pero no disponible todavia.

No agregar dependencias pesadas de Excel en esta fase salvo que sea imprescindible.

### 7. Soft Delete uniforme

Asegurar que:

- DELETE desactiva logicamente.
- PATCH activate reactiva.
- PATCH deactivate desactiva.

El comportamiento debe ser uniforme en todos los catalogos.

### 8. Runtime Actions

La metadata debe informar acciones disponibles:

- create
- update
- activate
- deactivate
- lookup
- export
- import

Considerar permisos cuando sea posible.

### 9. Seguridad

Todos los endpoints deben usar:

- requireAuth
- requireTenantContext
- requirePermission
- requireLicensedModule cuando aplique
- requireFeatureFlag cuando aplique
- RequestContext
- ResponseBuilder
- Zod

### 10. Auditoria

Registrar auditoria solo en acciones que cambien datos o estado.

No generar auditoria obligatoria para metadata ni lookup.

## Restricciones absolutas

No implementar:

- Clientes
- Proveedores
- Productos
- Inventario
- Compras
- Ventas
- Facturacion
- DGII
- POS
- Contabilidad
- Reportes funcionales
- Frontend completo de catalogos

No agregar:

- credenciales reales
- datos quemados obligatorios
- SQL dinamico inseguro
- dependencias innecesarias

## Verificacion obligatoria

Ejecutar:

```bash
npm install
npm run typecheck
npm run build
```

Confirmar que siguen funcionando:

```text
GET /api/health
GET /api/health/db
GET /api/version
```

## Entrega esperada en el PR

Incluir:

- resumen tecnico
- archivos creados
- archivos modificados
- endpoints creados
- metadata implementada
- lookup implementado
- contratos import/export creados si aplica
- resultado de npm install
- resultado de npm run typecheck
- resultado de npm run build
- confirmacion de que no se implementaron modulos fuera de alcance

No marques la tarea como completada si no compila.
