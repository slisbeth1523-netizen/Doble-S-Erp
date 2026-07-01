# Doble S ERP API

Backend base de Doble S ERP con Node.js, Express, TypeScript, JWT y SQL Server.

## Configuracion

1. Copiar `.env.example` a `.env`.
2. Completar credenciales reales de SQL Server.
3. Usar un `JWT_SECRET` seguro de al menos 32 caracteres.
4. Ejecutar la migracion inicial en `database/sqlserver/migrations/001_initial_saas_foundation.sql`.

## Endpoints base

- `GET /health`: estado de la API.
- `POST /api/auth/login`: autenticacion con email y password.
- `POST /api/auth/logout`: revoca la sesion JWT actual.
- `GET /api/auth/me`: usuario autenticado.
- `GET /api/core/me`: usuario y contexto tenant/empresa.
- `GET /api/core/tenants`: tenants activos.
- `GET /api/core/companies`: empresas activas disponibles para el usuario.
- `POST /api/core/companies`: crea empresa para el tenant actual.
- `GET /api/security/users`: usuarios del tenant.
- `POST /api/security/users`: crea usuario con password hasheado.
- `GET /api/security/roles`: roles del tenant.
- `POST /api/security/roles`: crea rol del tenant.
- `GET /api/security/permissions`: permisos registrados.

## Modulos

La API sigue una arquitectura modular:

- `core`
- `security`
- `fiscal`
- `sales`
- `purchases`
- `inventory`
- `accounting`
- `finance`
- `reports`
- `audit`

Cada modulo debe separar `api`, `application`, `domain`, `infrastructure` y `database`.

## Nota

Esta etapa solo implementa la fundacion tecnica. No contiene procesos grandes de ERP ni datos quemados.

## Sesiones y JWT

El login genera un `JwtId`, guarda la sesion en `security.Sessions` e incluye `jwtId` en el token.

Cada solicitud autenticada valida que la sesion exista, no este revocada y no este vencida. Un token cuya sesion fue revocada por logout deja de ser valido.

## Contexto multiempresa

Enviar `x-tenant-id` para establecer el tenant de trabajo.

Enviar `x-company-id` cuando el endpoint opere sobre una empresa legal. Si el usuario no tiene acceso a esa empresa en `security.UserCompanyAccess`, la API responde 403.

Para endpoints futuros que obligan empresa legal, usar `requireCompanyContext`.

## Permisos

Existe el middleware:

```ts
requirePermission(moduleCode: string, actionCode: string)
```

Consulta roles y permisos del usuario autenticado. Si el permiso no existe o no esta activo, responde 403 y registra `PERMISSION_DENIED`.

## Auditoria

- `audit.AuditLogs`: solicitudes tecnicas.
- `audit.AuditEvents`: acciones funcionales como login, logout, company created, user created, role created y permission denied.

## Onboarding

Usar `database/sqlserver/seeds/001_onboarding_admin.template.sql` para crear el primer tenant, empresa y usuario administrador con valores parametrizados.
