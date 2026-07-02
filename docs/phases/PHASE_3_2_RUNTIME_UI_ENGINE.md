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

## Implementacion

### Modulo runtime-ui

Se agrego el modulo frontend:

```text
apps/web/src/modules/runtime-ui
```

Con estructura:

```text
components/
hooks/
services/
types/
utils/
```

Tambien se agrego un archivo `index.ts` para exportar componentes, hooks, servicios, tipos y utilidades.

### Cliente de metadata y lookup

Se agrego:

```text
apps/web/src/modules/runtime-ui/services/metadataClient.ts
```

El cliente consume respuestas `ApiResponse<T>` de:

```text
GET /api/master-data/:catalog/metadata
GET /api/master-data/:catalog/lookup
GET /api/master-data/:catalog
```

Maneja errores de API, respuestas sin `data` y parametros de busqueda/paginacion.

### Hooks runtime

Se agregaron:

```text
apps/web/src/modules/runtime-ui/hooks/useCatalogMetadata.ts
apps/web/src/modules/runtime-ui/hooks/useCatalogLookup.ts
apps/web/src/modules/runtime-ui/hooks/useCatalogData.ts
```

Cada hook expone:

- `data`
- `loading`
- `error`
- `empty`

### Tipos runtime

Se agrego:

```text
apps/web/src/modules/runtime-ui/types/runtime-ui.types.ts
```

Incluye contratos para:

- metadata de catalogo
- campos runtime
- columnas de grid
- campos de formulario
- acciones runtime
- opciones lookup
- registros genericos de catalogo
- estado de recursos runtime

### DynamicForm

Se agrego:

```text
apps/web/src/modules/runtime-ui/components/DynamicForm.tsx
```

Renderiza campos segun metadata:

- `text`
- `number`
- `boolean`
- `date`
- `datetime`
- `select`
- `lookup`
- `textarea`

Respeta:

- `required`
- `readOnly`
- `editable`
- `placeholder`
- `helpText`
- `displayOrder`
- `visibleInForm`
- metadata de validacion

No contiene reglas especificas por catalogo.

### DynamicGrid

Se agrego:

```text
apps/web/src/modules/runtime-ui/components/DynamicGrid.tsx
```

Renderiza columnas segun metadata:

- `visibleInGrid`
- `displayOrder`
- `label`
- `type`
- `width`
- `align`
- `format`
- `sortable`
- `searchable`

Prepara soporte para:

- busqueda
- paginacion
- ordenamiento
- estado activo/inactivo

### FilterBuilder

Se agrego:

```text
apps/web/src/modules/runtime-ui/components/FilterBuilder.tsx
```

Permite construir filtros dinamicos para:

- `search`
- `isActive`
- `createdFrom`
- `createdTo`
- campos marcados como `searchable`

### Lookup component

Se agrego:

```text
apps/web/src/modules/runtime-ui/components/LookupField.tsx
```

Soporta:

- busqueda
- loading
- seleccion
- valor seleccionado
- limpiar seleccion

Consume `/api/master-data/:catalog/lookup` mediante `useCatalogLookup`.

### RuntimeActions

Se agrego:

```text
apps/web/src/modules/runtime-ui/components/RuntimeActions.tsx
```

Muestra acciones segun metadata:

- create
- update
- activate
- deactivate
- lookup
- export
- import

Cuando una accion no esta disponible, se renderiza deshabilitada.

### Validation Runtime

Se agrego:

```text
apps/web/src/modules/runtime-ui/utils/validationRuntime.ts
```

Transforma metadata de validacion en errores frontend para:

- `required`
- `minLength`
- `maxLength`
- `min`
- `max`
- `regex`
- `nullable`

### MasterDataRuntimePage

Se agrego:

```text
apps/web/src/modules/master-data/pages/MasterDataRuntimePage.tsx
```

La pagina generica combina:

- metadata
- acciones
- filtros
- grid
- formulario

Puede recibir `catalog` por propiedad o resolverlo desde una ruta tipo `/master-data/:catalog` si mas adelante se incorpora router. No se forzo una arquitectura de rutas nueva.

### UX minima

Se agregaron estilos en:

```text
apps/web/src/styles.css
```

Cubren:

- estados de carga
- errores
- sin datos
- acciones no disponibles
- formulario
- tabla
- filtros
- lookup
- layout runtime de una/dos columnas

### Limitaciones actuales

- La pagina generica queda preparada, pero no se agrego router global porque la aplicacion aun no tiene sistema de rutas.
- Los formularios validan en frontend, pero no ejecutan persistencia real desde esta pagina generica.
- El lookup es reutilizable y consume catalogos runtime; las fuentes especializadas se deben declarar en metadata futura si un campo requiere un catalogo diferente.
- No se agregaron dependencias nuevas.

No se implementaron clientes, proveedores, productos, inventario, compras, ventas, facturacion, DGII, POS, contabilidad, reportes funcionales, UI final de seguridad ni UI final de catalogos grandes.
