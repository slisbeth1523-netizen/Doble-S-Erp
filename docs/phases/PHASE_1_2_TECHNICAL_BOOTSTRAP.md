# Fase 1.2 - Bootstrap Tecnico del Monorepo

Fecha: 2026-06-29

## Objetivo

Crear la estructura tecnica inicial de Doble S ERP como proyecto SaaS modular, sin implementar todavia modulos funcionales grandes como clientes, proveedores, inventario, ventas, compras o facturacion.

Esta fase debe preparar el repositorio para que el desarrollo futuro sea ordenado, seguro y escalable.

## Contexto heredado

La Fase 1.1 ya definio la fundacion SaaS:

- Multi-tenant por `TenantId`.
- Multiempresa por `CompanyId`.
- Sesiones persistidas en SQL Server.
- JWT con `JwtId`.
- Logout con revocacion de sesion.
- Validacion real de acceso a empresa legal.
- Middleware `requireCompanyContext`.
- Middleware `requirePermission(moduleCode, actionCode)`.
- Auditoria funcional en `audit.AuditEvents`.
- Auditoria tecnica en `audit.AuditLogs`.
- Onboarding parametrizable del primer tenant, empresa y usuario administrador.

## Alcance de la Fase 1.2

Codex debe crear la estructura base del proyecto con enfoque profesional.

### 1. Estructura recomendada

Crear una estructura tipo monorepo:

```text
Doble-S-Erp/
├─ apps/
│  ├─ api/
│  └─ web/
├─ database/
│  └─ sqlserver/
│     ├─ migrations/
│     └─ seeds/
├─ docs/
│  ├─ phases/
│  └─ architecture/
├─ packages/
│  ├─ shared/
│  └─ config/
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

### 2. API base

Dentro de `apps/api`, crear una API Node.js + Express + TypeScript con:

- Configuracion estricta de TypeScript.
- Carga de variables de entorno.
- Conexion SQL Server usando `mssql`.
- Manejo centralizado de errores.
- Respuestas JSON estandarizadas.
- Health check publico.
- Health check de base de datos.
- Separacion por capas:
  - routes
  - controllers
  - services
  - repositories
  - middlewares
  - db
  - config
  - utils

### 3. Endpoints minimos

Crear solamente endpoints base:

```text
GET /api/health
GET /api/health/db
GET /api/version
```

No crear todavia endpoints de clientes, proveedores, inventario, ventas, compras ni facturacion.

### 4. Variables de entorno

Crear `.env.example` con variables como:

```text
NODE_ENV=development
API_PORT=4001
API_PREFIX=/api
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
JWT_SECRET=change_me
JWT_EXPIRES_IN=8h
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=DOBLE_S_ERP
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=change_me
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
```

No incluir credenciales reales.

### 5. Base de datos

Mantener las migraciones existentes en:

```text
database/sqlserver/migrations/
database/sqlserver/seeds/
```

Agregar archivos placeholder si todavia no existen, pero no inventar datos quemados.

### 6. Web base

Dentro de `apps/web`, crear una base React + Vite + TypeScript preparada para futuro portal ERP.

Debe incluir:

- Pantalla inicial simple.
- Estructura preparada para rutas futuras.
- Carpeta de servicios API.
- Carpeta de componentes comunes.
- Configuracion de variable `VITE_API_URL`.

No implementar todavia dashboards, clientes, ventas ni modulos completos.

### 7. Paquete compartido

Dentro de `packages/shared`, crear tipos compartidos basicos:

- `ApiResponse<T>`
- `PaginatedResponse<T>`
- `TenantContext`
- `CompanyContext`
- `UserContext`

### 8. Calidad y seguridad

Agregar:

- `.gitignore` correcto para Node, React, env, logs y builds.
- Scripts npm para desarrollo.
- Scripts npm para build.
- Scripts npm para typecheck.
- README con instrucciones de instalacion.
- Validacion de entorno al iniciar la API.
- No guardar secretos.
- No quemar tenants, empresas ni usuarios.

## Reglas obligatorias

Codex debe respetar estrictamente estas reglas:

- No implementar facturacion todavia.
- No implementar inventario todavia.
- No implementar ventas todavia.
- No implementar compras todavia.
- No implementar clientes ni proveedores todavia.
- No agregar datos quemados.
- No colocar contrasenas reales.
- No eliminar la documentacion existente.
- No romper la arquitectura SaaS definida.
- No crear logica fiscal dominicana avanzada en esta fase.
- Mantener TypeScript estricto.
- Mantener codigo modular.

## Criterios de aceptacion

La fase se considera completada cuando:

- El repositorio tiene estructura monorepo ordenada.
- La API compila en TypeScript.
- El frontend compila en TypeScript.
- Existe `.env.example` sin secretos reales.
- Existe health check publico.
- Existe health check de SQL Server.
- Existen tipos compartidos basicos.
- La documentacion explica como instalar y ejecutar.
- No se implementaron modulos fuera del alcance.

## Prompt recomendado para Codex

Implementa la Fase 1.2 del proyecto Doble S ERP siguiendo este documento. Crea la estructura tecnica inicial del monorepo con API Node.js + Express + TypeScript, frontend React + Vite + TypeScript, paquete compartido de tipos, configuracion de entorno, health checks y documentacion de instalacion. Respeta la fundacion SaaS definida en la Fase 1.1 y no implementes todavia modulos funcionales grandes como clientes, proveedores, inventario, ventas, compras ni facturacion.
