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

## Ejecutar localmente

Requisitos:

- Node.js 20 o superior.
- npm 10 o superior.
- SQL Server local o accesible desde la maquina de desarrollo.
- Una base de datos creada, por ejemplo `DOBLE_S_ERP`.

Pasos recomendados en Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
npm install
```

Edita `.env` y `apps/api/.env` con los datos reales de SQL Server:

```text
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=DOBLE_S_ERP
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=tu_password_local
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
```

El frontend usa:

```text
VITE_API_URL=http://localhost:4001/api
VITE_DEMO_LOGIN_ENABLED=true
VITE_DEMO_EMAIL=demo@dobles.local
VITE_DEMO_PASSWORD=Demo12345!
```

Ejecuta migraciones y datos locales:

```powershell
npm run db:setup
```

El seed local crea un tenant, una empresa, el usuario demo, permisos mínimos y datos de prueba para catálogos técnicos, clientes, proveedores, artículos, categorías y marcas. Es idempotente: puede ejecutarse varias veces sin duplicar datos.

Levantar API y Web por separado:

```powershell
npm run dev:api
npm run dev:web
```

O levantar ambos desde la raíz:

```powershell
npm run dev
```

URLs locales:

```text
API: http://localhost:4001/api
Web: http://localhost:5173
Health: http://localhost:4001/api/health
Version: http://localhost:4001/api/version
DB Health: http://localhost:4001/api/health/db
```

Rutas runtime principales:

```text
http://localhost:5173/master-data/customers
http://localhost:5173/master-data/suppliers
http://localhost:5173/master-data/items
http://localhost:5173/master-data/categories
http://localhost:5173/master-data/brands
```

Si la API o SQL Server no estan disponibles, el frontend mantiene la Vista local con metadata de respaldo para no romper la pantalla. Cuando la API responde y el login demo esta habilitado, el runtime prioriza metadata y registros reales.

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
