# Fase 3.1 - Master Data Runtime

Fecha: 2026-07-01

## Objetivo

Convertir el Master Data Engine en una plataforma runtime capaz de describir formularios, grids, lookups, validaciones, columnas, filtros, exportacion/importacion y comportamiento uniforme para catalogos maestros.

Esta fase no implementa catalogos funcionales grandes como clientes, proveedores, productos, inventario, compras, ventas, facturacion, DGII, POS, contabilidad ni reportes.

## Contexto heredado

La Fase 3.0 dejo implementado:

- modulo `master-data`.
- `CatalogDefinition`.
- `BaseCatalogRepository`.
- `BaseCatalogService`.
- router generico `/api/master-data/:catalog`.
- catalogos tecnicos iniciales.
- migracion `005_master_data_engine.sql`.

La Fase 3.1 debe ampliar ese motor para que los catalogos puedan ser renderizados y consumidos dinamicamente por frontend y otros modulos.

## Principio arquitectonico

El frontend no debe conocer campos, columnas ni reglas de cada catalogo de forma quemada.

La API debe entregar metadata suficiente para que el frontend pueda construir:

- formularios.
- grids.
- filtros.
- lookups.
- acciones.
- validaciones basicas.

## Alcance de la Fase 3.1

### 1. Metadata Engine

Extender `CatalogDefinition` para incluir metadata de campos.

Cada campo debe poder declarar:

- `field`.
- `label`.
- `type`.
- `required`.
- `visibleInGrid`.
- `visibleInForm`.
- `searchable`.
- `sortable`.
- `editable`.
- `readOnly`.
- `defaultValue` opcional.
- `placeholder` opcional.
- `helpText` opcional.
- `displayOrder`.

Tipos sugeridos:

- `text`.
- `number`.
- `boolean`.
- `date`.
- `datetime`.
- `select`.
- `lookup`.
- `textarea`.

### 2. Validation Metadata

Cada campo debe poder declarar reglas de validacion:

- `required`.
- `minLength`.
- `maxLength`.
- `min`.
- `max`.
- `regex`.
- `unique`.
- `nullable`.

Estas reglas deben servir para:

- validar en backend.
- entregar metadata al frontend.
- mantener consistencia entre formulario y API.

### 3. Endpoint de metadata

Crear endpoint:

```text
GET /api/master-data/:catalog/metadata
```

Debe devolver:

- definicion del catalogo.
- campos.
- columnas visibles.
- columnas ordenables.
- columnas buscables.
- acciones disponibles.
- reglas de validacion.
- permisos requeridos.
- si requiere licencia.
- si requiere feature flag.

### 4. Lookup Engine

Crear endpoint generico:

```text
GET /api/master-data/:catalog/lookup
```

Debe devolver datos compactos para selects y busquedas:

```ts
{
  value: string;
  label: string;
  code?: string;
  isActive?: boolean;
}
```

Debe soportar:

- `search`.
- `page`.
- `pageSize`.
- solo activos por defecto.
- seguridad y permisos.

### 5. Grid Runtime

Crear endpoint opcional o incluir en metadata configuracion de grid:

- columnas visibles.
- orden de columnas.
- ancho sugerido.
- alineacion.
- formato.
- si permite ordenar.
- si permite buscar.

No construir la UI completa todavia.

### 6. Form Runtime

Crear metadata para formularios:

- campos visibles.
- orden.
- tipo de input.
- required.
- readOnly.
- placeholder.
- helpText.
- validaciones.

No construir la UI completa todavia.

### 7. Import/Export Contracts

Preparar contratos para importacion/exportacion de catalogos.

No es obligatorio implementar procesamiento completo de Excel o CSV en esta fase, pero si deben quedar interfaces y endpoints placeholder seguros para futuro.

Sugeridos:

```text
GET /api/master-data/:catalog/export-template
POST /api/master-data/:catalog/import-preview
```

Si se implementan, deben devolver respuesta controlada indicando que la funcionalidad esta preparada o no disponible todavia.

No agregar dependencias pesadas de Excel si no es necesario.

### 8. Soft Delete uniforme

Formalizar que `DELETE` en master data equivale a desactivar.

Asegurar endpoints:

```text
PATCH /api/master-data/:catalog/:id/activate
PATCH /api/master-data/:catalog/:id/deactivate
```

Deben comportarse de forma uniforme para todos los catalogos.

### 9. Runtime Actions

La metadata debe informar acciones disponibles:

- create.
- update.
- activate.
- deactivate.
- lookup.
- export.
- import.

Las acciones deben considerar permisos actuales cuando aplique.

### 10. Seguridad

Todos los endpoints runtime deben usar:

- `requireAuth`.
- `requireTenantContext`.
- `requirePermission`.
- `requireLicensedModule` cuando aplique.
- `requireFeatureFlag` cuando aplique.
- `RequestContext`.

### 11. Auditoria

Registrar auditoria solo para acciones que cambien estado o datos.

Metadata, lookup y lectura no deben generar auditoria funcional obligatoria, salvo que ya exista un patron para ello.

### 12. Documentacion

Actualizar documentacion explicando:

- como declarar metadata de un campo.
- como el frontend debe consumir `/metadata`.
- como usar `/lookup`.
- como extender validaciones.
- como se manejaran import/export en el futuro.

## Restricciones absolutas

No implementar todavia:

- Clientes.
- Proveedores.
- Productos.
- Inventario.
- Compras.
- Ventas.
- Facturacion.
- DGII.
- POS.
- Contabilidad.
- Reportes funcionales.
- Frontend completo de catalogos.

No agregar:

- datos quemados obligatorios.
- credenciales reales.
- SQL dinamico inseguro.
- dependencias innecesarias.
- importacion Excel completa si no es estrictamente necesaria.

## Criterios de aceptacion

La fase se considera completada cuando:

- `CatalogDefinition` soporta metadata de campos.
- Existe endpoint `/api/master-data/:catalog/metadata`.
- Existe endpoint `/api/master-data/:catalog/lookup`.
- Los catalogos iniciales entregan metadata usable.
- Los catalogos iniciales entregan lookup usable.
- Existe contrato o placeholder seguro para export-template/import-preview si se decide incluir.
- Soft delete/activate/deactivate queda uniforme.
- Se usan validaciones declaradas.
- Se respeta seguridad existente.
- `npm run typecheck` pasa.
- `npm run build` pasa.
- Los endpoints de health/version siguen funcionando.
- No se implementaron modulos fuera de alcance.
