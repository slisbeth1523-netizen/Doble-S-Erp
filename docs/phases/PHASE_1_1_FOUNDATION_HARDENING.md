# Fase 1.1 - Endurecimiento de Fundacion SaaS

Fecha: 2026-06-29

## Objetivo

Endurecer la fundacion SaaS de Doble S ERP antes de avanzar a modulos grandes como clientes, proveedores, inventario, ventas, compras, facturacion y fiscalidad avanzada.

## Alcance implementado

- Sesiones reales persistidas en `security.Sessions`.
- Logout con revocacion de sesion.
- Validacion real de acceso a `CompanyId`.
- Middleware `requireCompanyContext` para endpoints que obligan empresa legal.
- Creacion de empresa con acceso automatico al usuario creador.
- Middleware base `requirePermission(moduleCode, actionCode)`.
- Auditoria funcional en `audit.AuditEvents`.
- Onboarding SQL parametrizable para primer tenant, empresa y usuario administrador.

## Sesiones

El login ahora:

- Genera un `JwtId` unico.
- Guarda sesion en `security.Sessions`.
- Incluye `jwtId` en el payload JWT.
- Calcula `ExpiresAt` desde `JWT_EXPIRES_IN`.
- Registra evento funcional `USER_LOGIN`.

`requireAuth` ahora valida:

- Token JWT valido.
- Sesion existente.
- Sesion no revocada.
- Sesion no vencida.

`POST /api/auth/logout` revoca la sesion actual y registra `USER_LOGOUT`.

## CompanyId

`requireTenantContext` ahora valida `x-company-id` cuando llega en la solicitud.

Si el usuario no tiene acceso en `security.UserCompanyAccess`, la API responde `403 COMPANY_FORBIDDEN`.

Tambien existe:

```ts
requireCompanyContext
```

Ese middleware se debe usar en endpoints futuros que no puedan operar sin empresa legal seleccionada.

## Creacion de empresas

`POST /api/core/companies` ahora:

- Crea la empresa.
- Crea acceso automatico en `security.UserCompanyAccess` para el usuario creador.
- Si es la primera empresa del tenant, la marca como default para el usuario cuando aplique.
- Ejecuta la operacion en transaccion SQL Server.
- Registra evento funcional `COMPANY_CREATED`.

## Permisos

Se agrego:

```ts
requirePermission(moduleCode: string, actionCode: string)
```

El middleware:

- Lee el usuario autenticado.
- Consulta roles y permisos del usuario.
- Valida permiso activo.
- Responde `403 PERMISSION_DENIED` si no tiene acceso.
- Registra evento funcional `PERMISSION_DENIED`.

No se aplica globalmente todavia para no bloquear endpoints durante la fundacion inicial. Debe aplicarse gradualmente por modulo y accion.

## Auditoria funcional

Se agrega la tabla:

```text
audit.AuditEvents
```

Permite registrar:

- `USER_LOGIN`
- `USER_LOGOUT`
- `COMPANY_CREATED`
- `USER_CREATED`
- `ROLE_CREATED`
- `PERMISSION_DENIED`

Campos principales:

- `TenantId`
- `CompanyId`
- `UserId`
- `Action`
- `EntityName`
- `EntityId`
- `MetadataJson`
- `CreatedAt`

La auditoria tecnica de solicitudes permanece en `audit.AuditLogs`.

## Onboarding inicial

Se creo:

```text
database/sqlserver/seeds/001_onboarding_admin.template.sql
```

La plantilla usa variables al inicio y no incluye contrasenas reales.

Variables principales:

- `@TenantName`
- `@TenantSlug`
- `@CompanyLegalName`
- `@CompanyTradeName`
- `@CompanyTaxId`
- `@AdminEmail`
- `@AdminDisplayName`
- `@AdminPasswordHash`

`@AdminPasswordHash` debe generarse fuera del script con el algoritmo de hashing de la API.

## Migraciones

- `001_initial_saas_foundation.sql`: fundacion SaaS inicial.
- `002_foundation_hardening.sql`: endurecimiento de sesiones, permisos y auditoria funcional.

## Reglas respetadas

- No se implemento facturacion.
- No se implemento inventario.
- No se implementaron ventas ni compras.
- No se agregaron datos quemados.
- Se mantiene arquitectura modular.
- Se preserva TypeScript estricto.
