# Fase 3.2 - Runtime UI Engine

Fecha: 2026-07-01

## Objetivo

Construir el motor frontend capaz de renderizar pantallas dinamicas basadas en la metadata entregada por el Master Data Runtime.

Esta fase prepara componentes reutilizables para formularios, grids, filtros, acciones, lookups y validaciones, sin implementar todavia pantallas funcionales completas de clientes, proveedores, productos, inventario, compras, ventas, facturacion, DGII, POS, contabilidad ni reportes.

## Contexto heredado

La Fase 3.1 dejo en backend:

- metadata por catalogo.
- endpoint `/api/master-data/:catalog/metadata`.
- endpoint `/api/master-data/:catalog/lookup`.
- metadata de grid.
- metadata de formulario.
- runtime actions.
- contratos import/export.
- soft delete uniforme.

La Fase 3.2 debe consumir esa metadata en React para construir componentes dinamicos reutilizables.

## Principio arquitectonico

El frontend no debe quemar campos, columnas, validaciones ni acciones de cada catalogo.

El frontend debe pedir metadata al backend y construir la experiencia usando componentes runtime.

## Alcance de la Fase 3.2

### 1. Runtime UI module

Crear un modulo frontend reusable bajo una ruta similar a:

```text
apps/web/src/modules/runtime-ui
```

Con estructura sugerida:

```text
components/
hooks/
services/
types/
utils/
```

### 2. Metadata client

Crear cliente para consumir:

```text
GET /api/master-data/:catalog/metadata
GET /api/master-data/:catalog/lookup
```

Debe usar la configuracion existente de API.

Debe manejar:

- loading.
- error.
- empty state.
- respuestas estandar `ApiResponse<T>`.

### 3. Dynamic Form Engine

Crear componente reusable para formularios dinamicos.

Sugerido:

```tsx
<DynamicForm catalog="currencies" />
```

Debe renderizar campos segun metadata:

- text.
- number.
- boolean.
- date.
- datetime.
- select.
- lookup.
- textarea.

Debe respetar:

- required.
- readOnly.
- editable.
- placeholder.
- helpText.
- displayOrder.
- visibleInForm.
- validation metadata.

No implementar todavia formularios especificos de clientes/proveedores.

### 4. Dynamic Grid Engine

Crear componente reusable para grids dinamicos.

Sugerido:

```tsx
<DynamicGrid catalog="currencies" />
```

Debe renderizar columnas segun metadata:

- visibleInGrid.
- displayOrder.
- label.
- type.
- width.
- alignment.
- format.
- sortable.
- searchable.

Debe preparar soporte para:

- paginacion.
- ordenamiento.
- busqueda.
- estado activo/inactivo.

No construir reportes funcionales.

### 5. Runtime Filter Builder

Crear componente para filtros dinamicos basado en metadata:

- search.
- isActive.
- createdFrom.
- createdTo.
- filtros por campos marcados como searchable.

Debe poder conectarse al grid.

### 6. Lookup component

Crear componente reusable para campos tipo lookup.

Debe consultar:

```text
/api/master-data/:catalog/lookup
```

Debe soportar:

- busqueda.
- loading.
- seleccion.
- valor seleccionado.
- limpiar seleccion.

No agregar dependencias pesadas si no son necesarias.

### 7. Runtime Actions

Crear componente o helper para mostrar acciones segun metadata:

- create.
- update.
- activate.
- deactivate.
- lookup.
- export.
- import.

Debe respetar permisos cuando la metadata indique que una accion no esta disponible.

### 8. Validation Runtime

Crear utilidad frontend para transformar validation metadata en validaciones de formulario.

Debe soportar:

- required.
- minLength.
- maxLength.
- min.
- max.
- regex.
- nullable.

No duplicar reglas manuales por catalogo.

### 9. Layout Runtime

Preparar estructura para layouts dinamicos:

- una columna.
- dos columnas.
- secciones.
- tabs en el futuro.

No es necesario implementar tabs completos si complica la fase, pero debe quedar preparada la estructura.

### 10. Master Data Runtime Page

Crear una pagina generica para catalogos:

```text
/apps/web/src/modules/master-data/pages/MasterDataRuntimePage.tsx
```

Debe poder cargar un catalogo por parametro o propiedad.

Debe combinar:

- metadata.
- grid.
- form.
- acciones.
- filtros.

Esta pagina debe ser generica, no especifica de monedas o unidades.

### 11. Rutas frontend base

Si existe sistema de rutas, agregar ruta generica sugerida:

```text
/master-data/:catalog
```

Si todavia no existe router, preparar el componente sin forzar una arquitectura de rutas completa.

### 12. UX minima

Implementar estados visuales basicos:

- cargando.
- error.
- sin datos.
- accion no disponible.

No dedicar esta fase a diseno visual avanzado.

### 13. Documentacion

Actualizar documentacion explicando:

- como consumir metadata.
- como usar DynamicForm.
- como usar DynamicGrid.
- como usar Lookup.
- como crear una pagina generica para un catalogo.
- limitaciones actuales.

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
- UI final de seguridad.
- UI final de catalogos grandes.

No agregar:

- credenciales reales.
- dependencias pesadas innecesarias.
- componentes especificos por catalogo.
- reglas quemadas por catalogo.

## Criterios de aceptacion

La fase se considera completada cuando:

- Existe modulo frontend `runtime-ui`.
- Existe cliente para metadata y lookup.
- Existe DynamicForm.
- Existe DynamicGrid.
- Existe FilterBuilder.
- Existe Lookup component.
- Existe RuntimeActions.
- Existe utilidad de validacion runtime.
- Existe pagina generica de master data runtime.
- El frontend compila.
- `npm run typecheck` pasa.
- `npm run build` pasa.
- Los endpoints existentes de API no se rompen.
- No se implementaron modulos fuera de alcance.
