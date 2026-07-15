# Fase 21.1 - Centros de costo

## Auditoria inicial

- La compania activa viaja en el contexto autenticado y en el encabezado `x-company-id`.
- Los catalogos por compania usan `TenantId` y `CompanyId` en SQL Server.
- Las migraciones son scripts SQL idempotentes bajo `database/sqlserver/migrations`.
- Los identificadores usan `UNIQUEIDENTIFIER` con `NEWSEQUENTIALID()`.
- La baja logica se maneja con `IsActive`; no se requiere borrado fisico para este catalogo.
- La metadata dinamica se expone por `/api/master-data/:catalog/metadata` y el fallback vive en `fallbackCatalogMetadata.ts`.
- El catalogo de cuentas actual existe en frontend con `localStorage` y no tiene persistencia SQL/API equivalente confirmada.

## Implementacion

- Se agrego la migracion `041_accounting_cost_centers_foundation.sql`.
- Se creo `accounting.CostCenters` con jerarquia, vigencia, baja logica, auditoria y `RowVersion`.
- Se registro el catalogo runtime `cost-centers` usando el motor existente de master data.
- Se agregaron validaciones backend para fechas, padre de la misma compania, padre propio y ciclos jerarquicos.
- Se agregaron permisos `accounting.cost-centers.*` al seed local y centros demo.
- Se agrego metadata fallback para `cost-centers`.
- Se restauro la navegacion funcional en Contabilidad > Centros de costo sin modificar estilos globales.
- Se amplio `smoke-local` con creacion raiz, creacion hija, edicion, busqueda, desactivacion/reactivacion y validaciones negativas.

## Fuera de alcance

- No se implementaron periodos contables.
- No se implementaron asientos contables.
- No se conectaron compras, inventario, cuentas por pagar ni cuentas por cobrar a contabilidad.
- No se modifico el catalogo de cuentas local ni se migro informacion del navegador a SQL Server.
- No se hicieron cambios visuales globales.
