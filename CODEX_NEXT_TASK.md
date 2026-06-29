# Tarea para Codex - Fase 1.2

## Proyecto

Doble S ERP

## Repositorio

`slisbeth1523-netizen/Doble-S-Erp`

## Objetivo inmediato

Implementar la Fase 1.2: bootstrap tecnico del monorepo.

Antes de programar, leer:

- `README.md`
- `docs/phases/PHASE_1_1_FOUNDATION_HARDENING.md`
- `docs/phases/PHASE_1_2_TECHNICAL_BOOTSTRAP.md`

## Instruccion principal

Crea la estructura tecnica inicial del ERP como monorepo profesional:

```text
apps/api
apps/web
database/sqlserver/migrations
database/sqlserver/seeds
docs/phases
docs/architecture
packages/shared
packages/config
```

## API

Crear API en `apps/api` usando:

- Node.js
- Express
- TypeScript estricto
- mssql
- dotenv
- cors
- helmet

Crear endpoints:

```text
GET /api/health
GET /api/health/db
GET /api/version
```

La API debe tener estructura modular:

```text
src/config
src/db
src/middlewares
src/routes
src/controllers
src/services
src/repositories
src/utils
```

## Web

Crear frontend en `apps/web` usando:

- React
- Vite
- TypeScript

Debe tener:

- Pantalla inicial simple de Doble S ERP.
- Preparacion para rutas futuras.
- Carpeta `src/components`.
- Carpeta `src/services`.
- Variable `VITE_API_URL`.

## Shared

Crear `packages/shared` con tipos compartidos:

```ts
ApiResponse<T>
PaginatedResponse<T>
TenantContext
CompanyContext
UserContext
```

## Configuracion

Crear o ajustar:

- `.env.example`
- `.gitignore`
- `package.json` raiz con scripts de trabajo
- README con instrucciones claras

## Restricciones obligatorias

No implementar aun:

- Clientes
- Proveedores
- Inventario
- Ventas
- Compras
- Facturacion
- Fiscalidad Dominicana avanzada
- Datos quemados
- Credenciales reales

## Resultado esperado

Al finalizar, el proyecto debe poder instalar dependencias, compilar TypeScript y ejecutar API/frontend base sin haber creado modulos funcionales grandes.
