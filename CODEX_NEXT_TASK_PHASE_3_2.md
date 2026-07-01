# Tarea para Codex - Fase 3.2 Runtime UI Engine

## Repositorio objetivo

Trabaja unicamente sobre:

```text
slisbeth1523-netizen/Doble-S-Erp
```

No crear repositorio nuevo. No trabajar sobre forks. No hacer merge directo a main.

## Objetivo

Implementar la Fase 3.2: Runtime UI Engine.

Esta fase construye componentes frontend reutilizables para renderizar formularios, grids, filtros, lookups y acciones basadas en metadata del backend.

No implementar clientes, proveedores, productos, inventario, compras, ventas, facturacion ni DGII.

## Leer antes de programar

- `README.md`
- `docs/phases/PHASE_3_0_MASTER_DATA_ENGINE.md`
- `docs/phases/PHASE_3_1_MASTER_DATA_RUNTIME.md`
- `docs/phases/PHASE_3_2_RUNTIME_UI_ENGINE.md`

## Crear rama

Crear una rama nueva:

```text
feature/phase-3-2-runtime-ui-engine
```

Abrir Pull Request al finalizar.

Titulo sugerido:

```text
feat: phase 3.2 runtime ui engine
```

No hacer merge.

## Instruccion principal

Implementa la infraestructura frontend definida en `docs/phases/PHASE_3_2_RUNTIME_UI_ENGINE.md` respetando la arquitectura existente.

No duplicar helpers existentes.
No crear pantallas completas de modulos funcionales.
No quemar campos por catalogo.

## Alcance obligatorio

### 1. Runtime UI module

Crear modulo frontend:

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

Debe manejar:

- loading
- error
- empty state
- `ApiResponse<T>`

### 3. DynamicForm

Crear componente:

```tsx
<DynamicForm catalog="currencies" />
```

Debe renderizar campos segun metadata:

- text
- number
- boolean
- date
- datetime
- select
- lookup
- textarea

Debe respetar:

- required
- readOnly
- editable
- placeholder
- helpText
- displayOrder
- visibleInForm
- validation metadata

### 4. DynamicGrid

Crear componente:

```tsx
<DynamicGrid catalog="currencies" />
```

Debe renderizar columnas segun metadata:

- visibleInGrid
- displayOrder
- label
- type
- width
- alignment
- format
- sortable
- searchable

Debe preparar soporte para:

- paginacion
- ordenamiento
- busqueda
- estado activo/inactivo

### 5. FilterBuilder

Crear componente para filtros dinamicos basado en metadata:

- search
- isActive
- createdFrom
- createdTo
- campos searchable

Debe poder conectarse al grid.

### 6. Lookup component

Crear componente reusable para campos tipo lookup.

Debe consultar:

```text
/api/master-data/:catalog/lookup
```

Debe soportar:

- busqueda
- loading
- seleccion
- limpiar seleccion

### 7. RuntimeActions

Crear componente/helper para acciones:

- create
- update
- activate
- deactivate
- lookup
- export
- import

Debe respetar metadata de acciones disponibles.

### 8. Validation Runtime

Crear utilidad para transformar validation metadata en validaciones frontend:

- required
- minLength
- maxLength
- min
- max
- regex
- nullable

No duplicar reglas manuales por catalogo.

### 9. MasterDataRuntimePage

Crear pagina generica:

```text
apps/web/src/modules/master-data/pages/MasterDataRuntimePage.tsx
```

Debe combinar:

- metadata
- grid
- form
- acciones
- filtros

Debe ser generica, no especifica de monedas ni unidades.

### 10. UX minima

Agregar estados:

- cargando
- error
- sin datos
- accion no disponible

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
- UI final de seguridad
- UI final de catalogos grandes

No agregar:

- credenciales reales
- dependencias pesadas innecesarias
- componentes especificos por catalogo
- reglas quemadas por catalogo

## Verificacion obligatoria

Ejecutar:

```bash
npm install
npm run typecheck
npm run build
```

Confirmar que frontend compila.

Confirmar que API no se rompe.

## Entrega esperada en el PR

Incluir:

- resumen tecnico
- archivos creados
- archivos modificados
- componentes creados
- hooks/servicios creados
- resultado de npm install
- resultado de npm run typecheck
- resultado de npm run build
- confirmacion de que no se implementaron modulos fuera de alcance

No marques la tarea como completada si no compila.
