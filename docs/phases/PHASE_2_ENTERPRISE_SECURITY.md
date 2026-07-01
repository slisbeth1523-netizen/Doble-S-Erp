# Fase 2 - Seguridad Empresarial

Fecha: 2026-07-01

## Objetivo

Construir el nucleo de seguridad empresarial del ERP sin implementar modulos funcionales como clientes, proveedores, inventario, compras, ventas, facturacion, DGII, POS, contabilidad ni reportes.

## Infraestructura reutilizada

La implementacion usa la infraestructura de Fase 1.3:

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

## Migracion creada

Se agrego `database/sqlserver/migrations/003_enterprise_security.sql`.

La migracion:

- Crea `security.Modules`.
- Crea `security.Actions`.
- Agrega `IsActive` y `UpdatedAt` a `security.Roles` cuando faltan.
- Agrega `UpdatedAt` a `security.Permissions` cuando falta.
- Agrega indices de apoyo para roles y permisos activos.

No modifica migraciones anteriores.

## API creada

Todos los endpoints quedan bajo `/api/security` y requieren autenticacion, contexto tenant y permiso explicito.

### Usuarios

- `GET /api/security/users`
- `POST /api/security/users`
- `PUT /api/security/users/:userId`
- `DELETE /api/security/users/:userId`

### Roles

- `GET /api/security/roles`
- `POST /api/security/roles`
- `PUT /api/security/roles/:roleId`
- `DELETE /api/security/roles/:roleId`

### Permisos

- `GET /api/security/permissions`
- `POST /api/security/permissions`
- `PUT /api/security/permissions/:permissionId`
- `DELETE /api/security/permissions/:permissionId`

### Modulos

- `GET /api/security/modules`
- `POST /api/security/modules`
- `PUT /api/security/modules/:moduleId`
- `DELETE /api/security/modules/:moduleId`

### Acciones

- `GET /api/security/actions`
- `POST /api/security/actions`
- `PUT /api/security/actions/:actionId`
- `DELETE /api/security/actions/:actionId`

### UserRoles

- `GET /api/security/user-roles`
- `POST /api/security/user-roles`
- `PUT /api/security/user-roles`
- `DELETE /api/security/user-roles`

### RolePermissions

- `GET /api/security/role-permissions`
- `POST /api/security/role-permissions`
- `PUT /api/security/role-permissions`
- `DELETE /api/security/role-permissions`

## Seguridad

Cada endpoint utiliza:

- `ResponseBuilder` para respuestas.
- `AppError` por medio de servicios base y middleware de errores.
- `Logger` para trazabilidad.
- `RequestContext` para tenant, usuario y correlacion.
- `requirePermission(moduleCode, actionCode)`.
- Auditoria funcional con `auditEvent`.
- Validacion Zod reutilizable.

## Multiempresa

La creacion de usuarios mantiene compatibilidad con `security.UserCompanyAccess` cuando se informa `defaultCompanyId`.

## Restricciones respetadas

No se implementaron:

- Clientes.
- Proveedores.
- Inventario.
- Compras.
- Ventas.
- Facturacion.
- DGII.
- POS.
- Contabilidad.
- Reportes.
