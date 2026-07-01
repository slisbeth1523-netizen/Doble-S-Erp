# Fase 3.0 - Master Data Engine

Fecha: 2026-07-01

## Objetivo

Construir el motor comun para catalogos maestros de Doble S ERP antes de implementar catalogos funcionales completos como clientes, proveedores, productos, bancos, monedas, impuestos, almacenes, unidades o categorias.

Esta fase prepara infraestructura reutilizable para que todos los catalogos compartan patrones de datos, validacion, seguridad, auditoria, paginacion, busqueda, estados, codigos y trazabilidad.

## Contexto heredado

Fase 1.3 dejo infraestructura comun:

- ConfigService.
- ClockService.
- Logger.
- AppError.
- ResponseBuilder.
- BaseSqlRepository.
- BaseService.
- RequestContext.
- Validacion con Zod.
- Auditoria funcional.
- Paginacion, filtros y ordenamiento seguro.

Fase 2 y 2.1 dejaron seguridad y control transversal:

- Usuarios.
- Roles.
- Permisos.
- Modulos.
- Acciones.
- Politicas.
- Licencias por tenant.
- Feature flags.
- Navegacion dinamica.
- Contexto de usuario.
- Middlewares de licencia y feature flags.

## Principio arquitectonico

No crear catalogos aislados.

Cada catalogo futuro debe reutilizar el mismo motor para:

- creacion.
- modificacion.
- activacion/desactivacion.
- busqueda.
- paginacion.
- ordenamiento.
- validacion.
- auditoria.
- seguridad.
- contexto SaaS.
- licencias.
- feature flags.

## Alcance de la Fase 3.0

### 1. Estructura modular de master data

Crear un modulo backend base bajo una ruta similar a:

```text
apps/api/src/modules/master-data
```

Con separacion clara:

```text
api/
application/
domain/
infrastructure/
validators/
```

No implementar frontend visual completo en esta fase.

### 2. Entidades base para catalogos

Definir contratos compartidos para catalogos maestros.

Campos conceptuales comunes:

- `id`.
- `tenantId`.
- `companyId` opcional cuando aplique.
- `code`.
- `name`.
- `description`.
- `isActive`.
- `createdAt`.
- `updatedAt`.
- `createdBy`.
- `updatedBy`.

No todos los catalogos usaran exactamente todos los campos, pero el motor debe soportar el patron.

### 3. Catalog definition

Crear una definicion tecnica de catalogo que permita declarar:

- nombre del catalogo.
- codigo del catalogo.
- tabla fisica.
- columnas permitidas para busqueda.
- columnas permitidas para ordenamiento.
- campos requeridos.
- permisos requeridos.
- modulo asociado.
- si usa `TenantId`.
- si usa `CompanyId`.
- si requiere licencia.
- si requiere feature flag.

Ejemplo conceptual:

```ts
CatalogDefinition
```

### 4. Base catalog repository

Crear repositorio base para catalogos usando `BaseSqlRepository`.

Debe soportar de forma segura:

- listar con paginacion.
- obtener por id.
- obtener por codigo.
- validar codigo unico por tenant/company.
- crear.
- actualizar.
- activar/desactivar.

No debe usar SQL dinamico inseguro.

Las columnas usadas deben venir de listas permitidas por cada catalogo.

### 5. Base catalog service

Crear servicio base para catalogos usando `BaseService`.

Debe centralizar:

- validaciones comunes.
- reglas de codigo unico.
- reglas de estado activo/inactivo.
- auditoria funcional.
- errores consistentes.
- contexto tenant/company.

### 6. Base catalog controller/router

Crear helpers para exponer endpoints estandar de catalogos.

Patron sugerido:

```text
GET /api/master-data/:catalog
GET /api/master-data/:catalog/:id
POST /api/master-data/:catalog
PUT /api/master-data/:catalog/:id
DELETE /api/master-data/:catalog/:id
PATCH /api/master-data/:catalog/:id/activate
PATCH /api/master-data/:catalog/:id/deactivate
```

El delete debe ser logico siempre que aplique, no borrado fisico.

### 7. Catalogos iniciales permitidos

Esta fase puede registrar catalogos tecnicos minimos para probar el motor, pero no debe construir pantallas completas.

Catalogos base permitidos:

- `currencies` / Monedas.
- `payment-terms` / Condiciones de pago.
- `tax-categories` / Categorias de impuestos.
- `units-of-measure` / Unidades de medida.

No implementar aun clientes, proveedores, productos ni inventario.

### 8. Migracion SQL Server

Crear migracion nueva, por ejemplo:

```text
database/sqlserver/migrations/005_master_data_engine.sql
```

Debe crear tablas base necesarias para los catalogos iniciales permitidos.

Tablas sugeridas:

- `core.Currencies`.
- `core.PaymentTerms`.
- `fiscal.TaxCategories`.
- `core.UnitsOfMeasure`.

Cada tabla debe respetar:

- `TenantId`.
- `CompanyId` cuando aplique.
- `Code`.
- `Name`.
- `Description`.
- `IsActive`.
- auditoria basica.
- indices utiles.
- restricciones de unicidad por tenant/company.

No insertar datos quemados obligatorios.

Si se crean seeds opcionales, deben ser parametrizables y documentados.

### 9. Seguridad

Cada catalogo debe validar:

- autenticacion.
- tenant context.
- company context cuando aplique.
- permisos.
- licencia del modulo si aplica.
- feature flag si aplica.

Debe usar los middlewares existentes:

- `requirePermission`.
- `requireLicensedModule` cuando aplique.
- `requireFeatureFlag` cuando aplique.

### 10. Auditoria

Registrar eventos funcionales:

- catalog item created.
- catalog item updated.
- catalog item activated.
- catalog item deactivated.

La auditoria debe usar `auditEvent` y no debe romper el flujo si falla.

### 11. Busqueda y filtros

Soportar filtros comunes:

- `search`.
- `isActive`.
- `createdFrom`.
- `createdTo`.

Usar paginacion y ordenamiento de Fase 1.3.

### 12. Validacion

Usar Zod para:

- create.
- update.
- params.
- query.

No aceptar payloads sin validar.

### 13. Documentacion

Actualizar documentacion explicando:

- como registrar un nuevo catalogo.
- como definir columnas permitidas.
- como aplicar permisos.
- como aplicar licencia y feature flag.
- como usar el endpoint generico.

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
- Pantallas completas de catalogos.

No agregar:

- datos quemados obligatorios.
- credenciales reales.
- SQL dinamico inseguro.
- borrado fisico por defecto.

## Criterios de aceptacion

La fase se considera completada cuando:

- Existe modulo `master-data`.
- Existe `CatalogDefinition` o equivalente.
- Existe `BaseCatalogRepository`.
- Existe `BaseCatalogService`.
- Existe router/controlador base para catalogos.
- Existen endpoints genericos bajo `/api/master-data`.
- Existen migraciones para catalogos iniciales permitidos.
- Monedas, condiciones de pago, categorias fiscales y unidades de medida funcionan como prueba del motor.
- Se usa validacion Zod.
- Se usa seguridad existente.
- Se usa auditoria funcional.
- Se usa paginacion, filtros y ordenamiento seguro.
- `npm run typecheck` pasa.
- `npm run build` pasa.
- Los endpoints de health/version siguen funcionando.
- No se implementaron modulos fuera de alcance.
