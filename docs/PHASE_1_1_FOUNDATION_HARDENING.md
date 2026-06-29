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

El login ahora genera un `JwtId`, guarda sesion en `security.Sessions`, incluye `jwtId` en el payload JWT, calcula `ExpiresAt` desde `JWT_EXPIRES_IN` y registra `USER_LOGIN`.

`requireAuth` valida token JWT, sesion existente, sesion no revocada y sesion no vencida.

`POST /api/auth/logout` revoca la sesion actual y registra `USER_LOGOUT`.

## CompanyId

`requireTenantContext` valida `x-company-id` cuando llega en la solicitud. Si el usuario no tiene acceso en `security.UserCompanyAccess`, la API responde `403 COMPANY_FORBIDDEN`.

Tambien existe `requireCompanyContext` para endpoints futuros que no puedan operar sin empresa legal seleccionada.

## Creacion de empresas

`POST /api/core/companies` crea la empresa, crea acceso automatico al usuario creador, marca default si es la primera empresa del tenant, ejecuta la operacion en transaccion SQL Server y registra `COMPANY_CREATED`.

## Permisos

Se agrego `requirePermission(moduleCode: string, actionCode: string)`.

El middleware lee el usuario autenticado, consulta roles y permisos, valida permiso activo, responde `403 PERMISSION_DENIED` si no tiene acceso y registra auditoria funcional.

No se aplica globalmente todavia para no bloquear endpoints durante la fundacion inicial. Debe aplicarse gradualmente por modulo y accion.

## Auditoria funcional

Se agrega `audit.AuditEvents` para eventos como `USER_LOGIN`, `USER_LOGOUT`, `COMPANY_CREATED`, `USER_CREATED`, `ROLE_CREATED` y `PERMISSION_DENIED`.

La auditoria tecnica de solicitudes permanece en `audit.AuditLogs`.

## Onboarding inicial

Se creo `database/sqlserver/seeds/001_onboarding_admin.template.sql`.

La plantilla usa variables al inicio y no incluye contrasenas reales. `@AdminPasswordHash` debe generarse fuera del script con el algoritmo de hashing de la API.

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
