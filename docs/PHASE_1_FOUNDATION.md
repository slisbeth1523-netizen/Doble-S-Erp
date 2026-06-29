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

`database/sqlserver/migrations/001_initial_saas_foundation.sql`

Incluye esquemas `core`, `security`, `fiscal` y `audit`, mas tablas base para tenants, empresas, sucursales, usuarios, roles, permisos, sesiones, configuracion fiscal y audit logs.

## Reglas respetadas

- No se implemento ventas.
- No se implemento compras.
- No se implemento inventario.
- No se implemento facturacion.
- No se agregaron datos quemados.
- Las tablas base contemplan `TenantId` y `CompanyId` cuando aplica.
- La arquitectura permanece modular.
