# Fase 2.1 - Motor de Seguridad, Navegacion y Licencias

Fecha: 2026-07-01

## Objetivo

Construir el motor transversal de seguridad, navegacion dinamica, acciones, politicas, licencias y feature flags de Doble S ERP.

Esta fase extiende la Fase 2 de Seguridad Empresarial, pero no implementa pantallas funcionales completas ni modulos de negocio como clientes, proveedores, inventario, compras, ventas, facturacion, DGII, POS, contabilidad o reportes.

## Contexto heredado

La Fase 1.3 dejo infraestructura reutilizable:

- ConfigService.
- ClockService.
- Logger.
- AppError.
- ResponseBuilder.
- BaseSqlRepository.
- BaseService.
- RequestContext.
- Validacion con Zod.
- Auditoria funcional.

La Fase 2 dejo seguridad empresarial base:

- Usuarios.
- Roles.
- Permisos.
- Modulos.
- Acciones.
- UserRoles.
- RolePermissions.
- UserCompanyAccess.
- Endpoints bajo `/api/security`.

## Alcance de la Fase 2.1

### 1. Motor de navegacion dinamica

Crear infraestructura para que el frontend pueda construir menus dinamicamente desde la API, no desde codigo quemado.

La navegacion debe contemplar:

- `NavigationId`.
- `TenantId` opcional cuando aplique.
- `ModuleId`.
- `ParentNavigationId` para menus jerarquicos.
- `Label`.
- `Route`.
- `Icon`.
- `DisplayOrder`.
- `IsVisible`.
- `IsActive`.
- `RequiredPermissionCode` opcional.
- Auditoria basica.

Ejemplo conceptual:

```text
Seguridad
  Usuarios
  Roles
  Permisos
```

No construir todavia el menu visual completo en React. Solo preparar API y modelo.

### 2. Acciones por pantalla o recurso

Extender el concepto de acciones para soportar controles finos del frontend.

Ejemplos futuros:

- Crear.
- Modificar.
- Eliminar.
- Exportar.
- Imprimir.
- Activar.
- Desactivar.
- Restablecer contraseña.

El backend debe permitir consultar las acciones disponibles segun modulo, rol y permiso.

### 3. Politicas de acceso

Agregar infraestructura para politicas mas alla de permiso si/no.

Ejemplos de alcance:

- Solo registros propios.
- Solo sucursal asignada.
- Solo empresa actual.
- Todo el tenant.

No implementar reglas de negocio de modulos todavia. Solo crear estructura y endpoints base.

### 4. Licencias por tenant

Preparar el control de licencias por cliente SaaS.

Debe permitir:

- Registrar modulos habilitados para un tenant.
- Consultar si un modulo esta habilitado.
- Bloquear acceso si el tenant no tiene licencia para un modulo.
- Registrar auditoria de cambios de licencia.

No implementar cobros, facturacion de suscripcion ni pasarela de pago.

### 5. Feature flags

Agregar feature flags por tenant y/o globales.

Debe permitir:

- Activar o desactivar funcionalidades futuras.
- Consultar flags activos.
- Validar flags desde middleware o servicio.

Ejemplos futuros:

```text
inventory.enabled
sales.enabled
electronicInvoice.enabled
pos.enabled
```

No activar modulos funcionales reales todavia.

### 6. Endpoint de contexto del usuario

Crear endpoint para que el frontend pueda inicializar la aplicacion despues del login.

Ejemplo:

```text
GET /api/security/me/context
```

Debe devolver:

- Usuario actual.
- Tenant actual.
- Empresa actual si aplica.
- Roles.
- Permisos.
- Modulos licenciados.
- Feature flags activos.
- Menu permitido.
- Acciones permitidas.

No implementar login nuevo en esta fase.

### 7. Middleware de licencia

Crear middleware reusable:

```ts
requireLicensedModule(moduleCode)
```

Debe validar si el tenant tiene habilitado el modulo.

Debe usar:

- RequestContext.
- AppError.
- Logger.
- ResponseBuilder.

### 8. Middleware de feature flag

Crear middleware reusable:

```ts
requireFeatureFlag(flagCode)
```

Debe validar si el flag esta activo para el tenant o globalmente.

### 9. Auditoria de seguridad ampliada

Registrar eventos funcionales para:

- Navegacion creada.
- Navegacion modificada.
- Navegacion desactivada.
- Licencia asignada.
- Licencia revocada.
- Feature flag activado.
- Feature flag desactivado.
- Politica asignada.
- Politica revocada.

La auditoria no debe romper el flujo principal si falla.

## Migraciones sugeridas

Crear una migracion nueva, por ejemplo:

```text
database/sqlserver/migrations/004_security_engine_navigation_licenses.sql
```

No modificar migraciones anteriores.

Tablas sugeridas:

- `security.NavigationItems`.
- `security.AccessPolicies`.
- `security.RolePolicies`.
- `security.TenantModuleLicenses`.
- `security.FeatureFlags`.
- `security.TenantFeatureFlags`.

Usar nombres consistentes con el esquema actual.

## API sugerida

Todos los endpoints deben quedar bajo `/api/security`.

### Navegacion

- `GET /api/security/navigation`
- `POST /api/security/navigation`
- `PUT /api/security/navigation/:navigationId`
- `DELETE /api/security/navigation/:navigationId`

### Politicas

- `GET /api/security/policies`
- `POST /api/security/policies`
- `PUT /api/security/policies/:policyId`
- `DELETE /api/security/policies/:policyId`

### Licencias

- `GET /api/security/licenses/modules`
- `POST /api/security/licenses/modules`
- `DELETE /api/security/licenses/modules/:licenseId`

### Feature flags

- `GET /api/security/feature-flags`
- `POST /api/security/feature-flags`
- `PUT /api/security/feature-flags/:flagId`
- `DELETE /api/security/feature-flags/:flagId`

### Contexto

- `GET /api/security/me/context`

## Reglas tecnicas obligatorias

Usar siempre:

- ConfigService.
- ClockService.
- Logger.
- AppError.
- ResponseBuilder.
- BaseSqlRepository.
- BaseService.
- RequestContext.
- Validacion con Zod.
- Auditoria funcional.

Cada endpoint debe usar validacion, permisos y auditoria cuando aplique.

## Restricciones absolutas

No implementar:

- Clientes.
- Proveedores.
- Inventario.
- Compras.
- Ventas.
- Facturacion.
- DGII.
- POS.
- Contabilidad.
- Reportes funcionales.
- Cobro de suscripciones.
- Pasarela de pagos.
- Login nuevo.

No agregar:

- Credenciales reales.
- Datos quemados obligatorios.
- Dependencias innecesarias.

## Criterios de aceptacion

La fase se considera completada cuando:

- Existe migracion nueva para navegacion, politicas, licencias y feature flags.
- Existe API base para navegacion.
- Existe API base para politicas.
- Existe API base para licencias de modulos.
- Existe API base para feature flags.
- Existe endpoint de contexto del usuario.
- Existe middleware `requireLicensedModule`.
- Existe middleware `requireFeatureFlag`.
- Se registra auditoria funcional en cambios relevantes.
- `npm run typecheck` pasa.
- `npm run build` pasa.
- Los endpoints base de health/version siguen funcionando.
- No se implementaron modulos funcionales fuera del alcance.
