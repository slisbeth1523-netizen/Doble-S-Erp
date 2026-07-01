# Tarea para Codex - Fase 3.0 Master Data Engine

## Repositorio objetivo

Trabaja unicamente sobre:

```text
slisbeth1523-netizen/Doble-S-Erp
```

No crear repositorio nuevo. No trabajar sobre forks. No hacer merge directo a main.

## Objetivo

Implementar la Fase 3.0: Master Data Engine.

Esta fase construye el motor comun para catalogos maestros del ERP, sin implementar todavia clientes, proveedores, productos, inventario, compras, ventas, facturacion ni DGII.

## Leer antes de programar

- `README.md`
- `docs/phases/PHASE_1_1_FOUNDATION_HARDENING.md`
- `docs/phases/PHASE_1_2_TECHNICAL_BOOTSTRAP.md`
- `docs/phases/PHASE_1_3_CORE_FRAMEWORK.md`
- `docs/phases/PHASE_2_ENTERPRISE_SECURITY.md`
- `docs/phases/PHASE_2_1_SECURITY_ENGINE_NAVIGATION_LICENSES.md`
- `docs/phases/PHASE_3_0_MASTER_DATA_ENGINE.md`

## Crear rama

Crear una rama nueva:

```text
feature/phase-3-0-master-data-engine
```

Abrir Pull Request al finalizar.

Titulo sugerido:

```text
feat: phase 3.0 master data engine
```

No hacer merge.

## Instruccion principal

Implementa el motor reusable de catalogos maestros definido en `docs/phases/PHASE_3_0_MASTER_DATA_ENGINE.md`.

No crear pantallas completas.
No crear clientes.
No crear proveedores.
No crear productos.
No crear inventario.
No crear ventas ni facturacion.

## Alcance obligatorio

### 1. Modulo master-data

Crear modulo backend bajo:

```text
apps/api/src/modules/master-data
```

Con estructura clara:

```text
api/
application/
domain/
infrastructure/
validators/
```

### 2. CatalogDefinition

Crear una definicion tecnica para catalogos que permita declarar:

- catalog code
- display name
- physical table
- id column
- code column
- name column
- allowed search columns
- allowed sort columns
- required permissions
- module code
- tenant scope
- company scope
- license requirement
- feature flag requirement

### 3. BaseCatalogRepository

Crear repositorio base usando `BaseSqlRepository`.

Debe soportar:

- listar con paginacion
- obtener por id
- obtener por codigo
- validar codigo unico
- crear
- actualizar
- activar
- desactivar

No usar SQL dinamico inseguro.
Solo permitir columnas declaradas en `CatalogDefinition`.

### 4. BaseCatalogService

Crear servicio base usando `BaseService`.

Debe centralizar:

- validaciones comunes
- codigo unico
- errores consistentes
- auditoria funcional
- contexto tenant/company

### 5. Router generico

Crear endpoints:

```text
GET /api/master-data/:catalog
GET /api/master-data/:catalog/:id
POST /api/master-data/:catalog
PUT /api/master-data/:catalog/:id
DELETE /api/master-data/:catalog/:id
PATCH /api/master-data/:catalog/:id/activate
PATCH /api/master-data/:catalog/:id/deactivate
```

DELETE debe ser logico o desactivacion, no borrado fisico por defecto.

### 6. Catalogos iniciales permitidos

Implementar solamente estos catalogos como prueba del motor:

- currencies
- payment-terms
- tax-categories
- units-of-measure

No implementar clientes, proveedores, productos ni inventario.

### 7. Migracion SQL Server

Crear nueva migracion:

```text
database/sqlserver/migrations/005_master_data_engine.sql
```

Crear tablas:

- `core.Currencies`
- `core.PaymentTerms`
- `fiscal.TaxCategories`
- `core.UnitsOfMeasure`

Cada tabla debe incluir:

- TenantId
- CompanyId cuando aplique
- Code
- Name
- Description
- IsActive
- CreatedAt
- UpdatedAt
- CreatedBy
- UpdatedBy
- indices utiles
- restriccion de unicidad por tenant/company y code

No insertar datos obligatorios quemados.

### 8. Seguridad

Usar:

- requirePermission
- requireLicensedModule cuando aplique
- requireFeatureFlag cuando aplique
- RequestContext
- AppError
- ResponseBuilder
- Logger
- Zod
- auditEvent

### 9. Busqueda, filtros y ordenamiento

Soportar:

- search
- isActive
- createdFrom
- createdTo
- page
- pageSize
- sortBy
- sortDirection

Usar utilidades ya creadas. No duplicar.

### 10. Auditoria

Registrar eventos:

- master data item created
- master data item updated
- master data item activated
- master data item deactivated

La auditoria no debe romper el flujo si falla.

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
- Pantallas completas

No agregar:

- credenciales reales
- datos quemados obligatorios
- SQL dinamico inseguro
- borrado fisico por defecto

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
- migracion creada
- endpoints creados
- catalogos iniciales implementados
- validaciones agregadas
- auditoria implementada
- resultado de npm install
- resultado de npm run typecheck
- resultado de npm run build
- confirmacion de que no se implementaron modulos fuera de alcance

No marques la tarea como completada si no compila.
