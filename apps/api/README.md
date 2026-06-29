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
- `POST /api/auth/logout`: salida para clientes JWT stateless.
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

## Nota

Esta etapa solo implementa la fundacion tecnica. No contiene procesos grandes de ERP ni datos quemados.
