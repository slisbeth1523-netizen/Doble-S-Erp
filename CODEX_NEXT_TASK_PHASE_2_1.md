# Tarea para Codex - Fase 2.1 Motor de Seguridad, Navegacion y Licencias

## Repositorio objetivo

Trabaja unicamente sobre:

```text
slisbeth1523-netizen/Doble-S-Erp
```

No crear repositorio nuevo. No trabajar sobre forks. No hacer merge directo a main.

## Objetivo

Implementar la Fase 2.1: motor transversal de seguridad, navegacion dinamica, politicas, licencias y feature flags.

Esta fase extiende la seguridad empresarial existente y prepara al ERP para controlar modulos por permisos, politicas y licencias.

## Leer antes de programar

- `README.md`
- `docs/phases/PHASE_1_1_FOUNDATION_HARDENING.md`
- `docs/phases/PHASE_1_2_TECHNICAL_BOOTSTRAP.md`
- `docs/phases/PHASE_1_3_CORE_FRAMEWORK.md`
- `docs/phases/PHASE_2_ENTERPRISE_SECURITY.md`
- `docs/phases/PHASE_2_1_SECURITY_ENGINE_NAVIGATION_LICENSES.md`

## Instruccion principal

Implementa la infraestructura definida en `docs/phases/PHASE_2_1_SECURITY_ENGINE_NAVIGATION_LICENSES.md` respetando toda la arquitectura existente.

No reemplazar componentes ya implementados.
No duplicar helpers.
No crear modulos funcionales fuera del alcance.

## Crear rama

Crear una rama nueva:

```text
feature/phase-2-1-security-engine-navigation-licenses
```

Abrir Pull Request al finalizar.

Titulo sugerido:

```text
feat: phase 2.1 security engine navigation licenses
```

No hacer merge.

## Alcance obligatorio

### 1. Migracion SQL Server

Crear una nueva migracion:

```text
database/sqlserver/migrations/004_security_engine_navigation_licenses.sql
```

No modificar migraciones anteriores.

Crear estructura para:

- `security.NavigationItems`
- `security.AccessPolicies`
- `security.RolePolicies`
- `security.TenantModuleLicenses`
- `security.FeatureFlags`
- `security.TenantFeatureFlags`

Asegurar:

- claves primarias
- indices utiles
- campos `CreatedAt`, `UpdatedAt`, `IsActive` cuando aplique
- compatibilidad con `TenantId`
- compatibilidad con modulos existentes

### 2. Navegacion dinamica

Crear API bajo `/api/security/navigation`:

- `GET /api/security/navigation`
- `POST /api/security/navigation`
- `PUT /api/security/navigation/:navigationId`
- `DELETE /api/security/navigation/:navigationId`

Debe soportar jerarquia mediante `ParentNavigationId`.

Debe permitir construir menus por permisos.

No construir frontend visual completo todavia.

### 3. Politicas de acceso

Crear API bajo `/api/security/policies`:

- `GET /api/security/policies`
- `POST /api/security/policies`
- `PUT /api/security/policies/:policyId`
- `DELETE /api/security/policies/:policyId`

Preparar politicas como:

- OWN_RECORDS
- BRANCH_ONLY
- COMPANY_ONLY
- TENANT_WIDE

No aplicar reglas de negocio especificas todavia.

### 4. Licencias por modulo

Crear API bajo `/api/security/licenses/modules`:

- `GET /api/security/licenses/modules`
- `POST /api/security/licenses/modules`
- `DELETE /api/security/licenses/modules/:licenseId`

Preparar consulta de modulos habilitados por tenant.

Crear middleware:

```ts
requireLicensedModule(moduleCode)
```

Debe validar si el tenant actual tiene el modulo habilitado.

### 5. Feature flags

Crear API bajo `/api/security/feature-flags`:

- `GET /api/security/feature-flags`
- `POST /api/security/feature-flags`
- `PUT /api/security/feature-flags/:flagId`
- `DELETE /api/security/feature-flags/:flagId`

Crear middleware:

```ts
requireFeatureFlag(flagCode)
```

Debe validar flags globales y flags por tenant.

### 6. Contexto del usuario

Crear endpoint:

```text
GET /api/security/me/context
```

Debe devolver:

- usuario actual
- tenant actual
- empresa actual si aplica
- roles
- permisos
- modulos licenciados
- feature flags activos
- menu permitido
- acciones permitidas

No crear login nuevo.

### 7. Auditoria

Registrar eventos funcionales para cambios relevantes:

- navegacion creada/modificada/desactivada
- politica creada/modificada/desactivada
- licencia asignada/revocada
- feature flag creado/modificado/desactivado

La auditoria no debe romper el flujo principal si falla.

## Reglas tecnicas obligatorias

Usar siempre:

- ConfigService
- ClockService
- Logger
- AppError
- ResponseBuilder
- BaseSqlRepository
- BaseService
- RequestContext
- Validacion con Zod
- Auditoria funcional
- requirePermission donde aplique

## Restricciones absolutas

No implementar:

- Clientes
- Proveedores
- Inventario
- Compras
- Ventas
- Facturacion
- DGII
- POS
- Contabilidad
- Reportes funcionales
- Cobro de suscripciones
- Pasarela de pagos
- Login nuevo

No agregar credenciales reales ni datos quemados obligatorios.

## Verificacion obligatoria

Ejecutar:

```bash
npm install
npm run typecheck
npm run build
```

Confirmar que siguen funcionando:

```text
GET /api/health
GET /api/health/db
GET /api/version
```

## Entrega esperada

En el Pull Request incluir:

- resumen tecnico
- archivos creados
- archivos modificados
- migraciones creadas
- endpoints creados
- middlewares creados
- auditoria implementada
- resultado de `npm install`
- resultado de `npm run typecheck`
- resultado de `npm run build`
- confirmacion de que no se implementaron modulos fuera del alcance

No marques la tarea como completada si no compila.
