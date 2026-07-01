# Doble S ERP

ERP SaaS multiempresa orientado a negocios en Republica Dominicana.

## Objetivo

Construir una base moderna, segura y modular para un ERP comercializable, preparado para manejar multiples clientes SaaS, multiples empresas legales por cliente, roles, permisos, auditoria, configuracion fiscal y crecimiento gradual por modulos.

## Arquitectura base

La base de datos debe contemplar arquitectura SaaS multiempresa:

- `TenantId` para separacion por cliente SaaS.
- `CompanyId` para separacion por empresa legal.
- Auditoria en tablas transaccionales.
- Migraciones trazables.
- Reglas fiscales parametrizables.

## SQL Server

Carpeta reservada para scripts, migraciones, esquemas, vistas, funciones y procedimientos relacionados con SQL Server.

## Migraciones iniciales

- `database/sqlserver/migrations/001_initial_saas_foundation.sql`: crea esquemas `core`, `security`, `fiscal` y `audit`, con tablas base para tenants, empresas, sucursales, usuarios, roles, permisos, sesiones, configuracion fiscal y audit logs.
- `database/sqlserver/migrations/002_foundation_hardening.sql`: agrega auditoria funcional, estado activo para permisos e indice unico de sesiones por `JwtId`.

No se incluyen usuarios, empresas ni datos de prueba quemados. Esos datos deben crearse mediante procesos de onboarding o scripts parametrizados por ambiente.

## Onboarding

- `database/sqlserver/seeds/001_onboarding_admin.template.sql`: plantilla parametrizable para crear el primer tenant, empresa y usuario administrador.

La plantilla no incluye contrasenas reales. El valor `@AdminPasswordHash` debe generarse fuera del script usando el algoritmo de hashing configurado en la API.

## Estado actual

- Fase 1.1 documentada: endurecimiento de fundacion SaaS.
- Siguiente paso: Fase 1.2, estructura tecnica inicial del monorepo, API, configuracion, migraciones y health checks.

## Fase 1.2 - Bootstrap tecnico

El repositorio queda organizado como monorepo:

```text
apps/
  api/
  web/
database/
  sqlserver/
    migrations/
    seeds/
docs/
  phases/
  architecture/
packages/
  shared/
  config/
```

## Instalacion

```bash
npm install
```

Copiar `.env.example` a `.env` y completar valores locales sin usar credenciales reales.

## API

La API usa Node.js, Express, TypeScript, SQL Server, dotenv, cors y helmet.

```bash
npm run dev:api
```

Endpoints base:

```text
GET http://localhost:4001/api/health
GET http://localhost:4001/api/health/db
GET http://localhost:4001/api/version
```

## Web

El frontend usa React, Vite y TypeScript.

```bash
npm run dev:web
```

La variable `VITE_API_URL` define la URL base de la API.

## Calidad

```bash
npm run typecheck
npm run build
```

Esta fase no implementa clientes, proveedores, inventario, ventas, compras, facturacion ni fiscalidad dominicana avanzada.
