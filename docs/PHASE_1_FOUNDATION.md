# Fase 1 - Fundacion SaaS

Fecha: 2026-06-29

## Objetivo

Crear la base real del backend de Doble S ERP para autenticacion, multiempresa, usuarios, roles, permisos, auditoria y conexion SQL Server, sin implementar modulos grandes de negocio.

## Stack implementado

- Node.js.
- Express.
- TypeScript.
- SQL Server mediante `mssql`.
- JWT mediante `jsonwebtoken`.
- Variables de entorno con `dotenv`.
- Validaciones con `zod`.

## Estructura backend

La API vive en `apps/api` y mantiene arquitectura modular:

```text
apps/api/src/
  app.ts
  server.ts
  shared/
    config/
    database/
    errors/
    http/
    types/
  modules/
    audit/
    core/
    security/
    fiscal/
    sales/
    purchases/
    inventory/
    accounting/
    finance/
    reports/
```

Cada modulo conserva separacion entre:

- `api`
- `application`
- `domain`
- `infrastructure`
- `database`

## Implementado

- Servidor base en `apps/api/src/server.ts`.
- App principal en `apps/api/src/app.ts`.
- Carga y validacion de variables de entorno.
- Conexion SQL Server en `apps/api/src/shared/database/sqlserver.ts`.
- Middleware global de errores.
- Middleware de autenticacion JWT.
- Middleware de contexto multiempresa con `TenantId`, `CompanyId` y usuario autenticado.
- Auditoria tecnica de solicitudes.
- Validaciones basicas con `zod`.
- Migracion inicial SQL Server.

## Endpoints minimos

- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/core/tenants`
- `GET /api/core/companies`
- `POST /api/core/companies`
- `GET /api/security/users`
- `POST /api/security/users`
- `GET /api/security/roles`
- `POST /api/security/roles`
- `GET /api/security/permissions`

## Migracion inicial

Archivo:

`database/sqlserver/migrations/001_initial_saas_foundation.sql`

Incluye:

- Esquema `core`.
- Esquema `security`.
- Esquema `fiscal`.
- Esquema `audit`.
- `core.Tenants`.
- `core.Companies`.
- `core.Branches`.
- `security.Users`.
- `security.UserCompanyAccess`.
- `security.Roles`.
- `security.Permissions`.
- `security.RolePermissions`.
- `security.UserRoles`.
- `security.Sessions`.
- `fiscal.CompanyFiscalSettings`.
- `audit.AuditLogs`.

## Reglas respetadas

- No se implemento ventas.
- No se implemento compras.
- No se implemento inventario.
- No se implemento facturacion.
- No se agregaron datos quemados.
- Las tablas base contemplan `TenantId` y `CompanyId` cuando aplica.
- La arquitectura permanece modular.

## Pendientes para siguientes fases

- Onboarding parametrizado de tenant, empresa y primer usuario.
- Politicas granulares de permisos por endpoint.
- Revocacion persistente de sesiones JWT.
- Pruebas automatizadas de seguridad y multiempresa.
- Migraciones incrementales por modulo.
- Integracion fiscal RD avanzada.

