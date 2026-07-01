# Fase 1.3 - Core Framework

Fecha: 2026-06-29

## Objetivo

Construir la infraestructura comun que usaran todos los modulos futuros de Doble S ERP, antes de implementar clientes, proveedores, inventario, ventas, compras, facturacion o DGII.

Esta fase deja una base tecnica reusable, consistente y segura para que los modulos de negocio no repitan logica ni estructuras.

## Contexto heredado

La Fase 1.1 dejo definida la fundacion SaaS:

- Multi-tenant por `TenantId`.
- Multiempresa por `CompanyId`.
- Sesiones persistidas.
- JWT con `JwtId`.
- Validacion de acceso por empresa.
- Permisos base.
- Auditoria funcional y tecnica.

La Fase 1.2 dejo implementado el bootstrap tecnico:

- Monorepo.
- API Express + TypeScript.
- Frontend React + Vite + TypeScript.
- Packages compartidos.
- Health checks.
- Manejo resiliente de errores base.
- SQL Server preparado.

## Utilidades implementadas

### Config service

`apps/api/src/config/config.service.ts` centraliza la configuracion de la API.

Los modulos deben leer configuracion con:

```ts
config.get("api.port");
config.get("jwt.secret");
config.get("sql.host");
config.get("sql.database");
config.get("sql.user");
config.get("sql.password");
```

El servicio valida variables requeridas al iniciar y detiene la API con un mensaje claro si falta configuracion obligatoria. Fuera de este servicio no se debe leer `process.env` directamente.

### Clock service

`apps/api/src/utils/clock.ts` centraliza fechas:

- `clock.now()`
- `clock.utcNow()`
- `clock.today()`
- `clock.isoNow()`
- `clock.addMilliseconds()`
- `clock.parse()`

La auditoria y los modulos futuros deben usar este servicio en lugar de fechas dispersas.

### Response builder

El contrato compartido `ApiResponse<T>` soporta:

- `success`
- `message`
- `data`
- `error`
- `meta`

Los controladores deben usar `apps/api/src/utils/responseBuilder.ts` para evitar formatos distintos. `api-response.ts` queda como compatibilidad y delega al builder unico.

### Errores

Se agrego una jerarquia central en `apps/api/src/errors`:

- `AppError`
- `BadRequestError`
- `UnauthorizedError`
- `ForbiddenError`
- `NotFoundError`
- `ConflictError`
- `ValidationError`

Los middlewares de error convierten errores operacionales y errores de validacion en respuestas JSON consistentes sin exponer stack traces, credenciales ni detalles internos.

### Logger

`apps/api/src/utils/logger.ts` provee:

- `debug`
- `info`
- `warn`
- `error`

El servidor usa el logger al iniciar. Los modulos futuros deben evitar `console.log` disperso.

### Validacion

`apps/api/src/utils/validateRequest.ts` permite validar con `zod`:

- `body`
- `params`
- `query`
- `headers`

Los errores de validacion se responden como HTTP 400 con formato estandar.

### Paginacion

`apps/api/src/utils/pagination.ts` y `packages/shared/src/pagination.ts` definen:

- `page`
- `pageSize`
- `offset`
- `limit`
- `totalItems`
- `totalPages`

Reglas aplicadas:

- `page` minimo 1.
- `pageSize` minimo 1.
- `pageSize` maximo 100.
- valores por defecto seguros.

### Ordenamiento

`apps/api/src/utils/sorting.ts` valida:

- `sortBy` contra una lista permitida.
- `sortDirection` solo como `asc` o `desc`.

Los modulos futuros deben mapear columnas permitidas y no concatenar valores de usuario directamente en SQL.

### Filtros base

`packages/shared/src/filters.ts` y `apps/api/src/utils/filters.ts` preparan filtros comunes:

- `search`
- `isActive`
- `createdFrom`
- `createdTo`

No se implementaron filtros de modulos funcionales.

### Contexto SaaS

`RequestContext` estandariza:

- `tenantId`
- `companyId`
- `userId`
- `jwtId`
- `permissions`
- `requestId`
- `correlationId`

`apps/api/src/middlewares/request-context.middleware.ts` asigna `requestId` y `correlationId` por solicitud y los expone como headers. `apps/api/src/utils/requestContext.ts` lee esos valores desde la solicitud actual sin crear autenticacion nueva.

### Base SQL Repository

`apps/api/src/repositories/BaseSqlRepository.ts` prepara una base reusable para:

- obtener el pool SQL Server actual.
- ejecutar queries parametrizadas.
- ejecutar stored procedures.
- ejecutar transacciones.
- manejar errores SQL sin exponer mensajes internos.
- centralizar acceso seguro a SQL Server.

No contiene CRUD de modulos de negocio.

### Base Service

`apps/api/src/services/BaseService.ts` centraliza helpers comunes para servicios futuros:

- validar existencia de recursos.
- validar reglas de negocio comunes.
- separar controller, service y repository.

No contiene reglas de negocio especificas.

### Auditoria

`apps/api/src/utils/audit.ts` prepara `auditEvent` para registrar eventos funcionales futuros con:

- `tenantId`
- `companyId`
- `userId`
- `action`
- `entity` o `entityName`
- `entityId`
- `metadata`
- `timestamp`

Si el registro falla, se emite warning y no se rompe el flujo principal.

## Restricciones respetadas

- No se implementaron clientes.
- No se implementaron proveedores.
- No se implemento inventario.
- No se implementaron ventas.
- No se implementaron compras.
- No se implemento facturacion.
- No se implemento DGII.
- No se agregaron datos quemados.
- No se agregaron credenciales reales.
- No se agregaron endpoints funcionales nuevos.

## Criterios de aceptacion

- Existe manejo centralizado de errores con `AppError`.
- Existe logger base.
- Existe validacion reutilizable con `zod`.
- Existen utilidades de paginacion.
- Existen utilidades de ordenamiento seguro.
- Existen tipos de filtros comunes.
- Existe contexto SaaS estandarizado.
- Existe base reusable para repositorios SQL Server.
- Existe helper preparado para auditoria funcional.
- Todos los endpoints existentes siguen funcionando.
- `npm run typecheck` pasa.
- `npm run build` pasa.
- No se implementaron modulos fuera de alcance.
