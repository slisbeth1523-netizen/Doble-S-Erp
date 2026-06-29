# Fase 1.3 - Core Framework

Fecha: 2026-06-29

## Objetivo

Construir la infraestructura comun que usaran todos los modulos futuros de Doble S ERP, antes de implementar clientes, proveedores, inventario, ventas, compras, facturacion o DGII.

Esta fase debe dejar una base tecnica reusable, consistente y segura para que los modulos de negocio no repitan logica ni estructuras.

## Contexto heredado

La Fase 1.1 dejo definida la fundacion SaaS:

- Multi-tenant por `TenantId`.
- Multiempresa por `CompanyId`.
- Sesiones persistidas.
- JWT con `JwtId`.
- Validacion de acceso por empresa.
- Permisos base.
- Auditoria funcional y tecnica.

La Fase 1.2 dejo implementado el bootstrap tecnico:

- Monorepo.
- API Express + TypeScript.
- Frontend React + Vite + TypeScript.
- Packages compartidos.
- Health checks.
- Manejo resiliente de errores base.
- SQL Server preparado.

## Alcance de la Fase 1.3

Implementar utilidades transversales para los modulos futuros.

### 1. Respuesta estandar de API

Todas las respuestas deben mantener un formato uniforme:

```ts
{
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}
```

Debe evitarse que cada controlador arme respuestas con formatos distintos.

### 2. Manejo centralizado de errores

Crear una clase base `AppError` con:

- `statusCode`
- `code`
- `message`
- `details` opcional
- `isOperational`

Crear errores especificos reutilizables:

- `BadRequestError`
- `UnauthorizedError`
- `ForbiddenError`
- `NotFoundError`
- `ConflictError`
- `ValidationError`

El middleware de errores debe:

- No exponer stack trace en produccion.
- No exponer credenciales.
- Responder JSON consistente.
- Registrar errores de forma controlada.

### 3. Logger base

Agregar un logger reutilizable para API.

Debe soportar niveles:

- `debug`
- `info`
- `warn`
- `error`

Debe estar preparado para reemplazarse mas adelante por una libreria profesional si se desea.

No usar `console.log` disperso en los modulos futuros.

### 4. Validacion de entrada

Agregar una estrategia de validacion con `zod`.

Crear helper/middleware reutilizable para validar:

- `body`
- `params`
- `query`
- `headers` cuando sea necesario

Si la validacion falla, debe responder HTTP 400 con formato estandar.

### 5. Paginacion estandar

Crear tipos y utilidades para paginacion:

- `page`
- `pageSize`
- `offset`
- `limit`
- `totalItems`
- `totalPages`

Reglas:

- `page` minimo 1.
- `pageSize` minimo 1.
- `pageSize` maximo recomendado 100.
- Valores por defecto seguros.

### 6. Ordenamiento estandar

Crear utilidades para ordenar resultados:

- `sortBy`
- `sortDirection`

Reglas:

- Solo permitir columnas definidas por cada modulo.
- Evitar SQL injection.
- `sortDirection` solo puede ser `asc` o `desc`.

### 7. Filtros base

Preparar tipos para filtros comunes:

- `search`
- `isActive`
- `createdFrom`
- `createdTo`

No implementar filtros de clientes ni inventario todavia.

### 8. Contexto SaaS por solicitud

Estandarizar el tipo de contexto de solicitud para:

- `TenantId`
- `CompanyId`
- `UserId`
- `jwtId`
- permisos futuros

No implementar autenticacion nueva en esta fase, solo preparar tipos y helpers.

### 9. BaseRepository conceptual

Crear una base reusable para repositorios SQL Server, sin crear modulos de negocio.

Debe incluir helpers seguros para:

- Ejecutar queries parametrizadas.
- Manejar transacciones.
- Obtener pool.
- Evitar SQL dinamico inseguro.

No crear CRUD completo de clientes/proveedores todavia.

### 10. BaseService conceptual

Crear estructura base para servicios futuros:

- Validacion de reglas comunes.
- Manejo de errores de negocio.
- Separacion clara de controlador, servicio y repositorio.

### 11. Auditoria preparada

Preparar helper para registrar eventos funcionales futuros, sin implementar eventos especificos de modulos.

Debe aceptar:

- `tenantId`
- `companyId`
- `userId`
- `action`
- `entityName`
- `entityId`
- `metadata`

No debe fallar el proceso principal si el registro de auditoria falla; debe registrarse warning.

### 12. Documentacion

Actualizar documentacion tecnica de la fase explicando:

- Utilidades creadas.
- Como deben usarlas los modulos futuros.
- Restricciones respetadas.

## Reglas obligatorias

No implementar todavia:

- Clientes
- Proveedores
- Inventario
- Ventas
- Compras
- Caja y bancos
- Facturacion
- DGII
- POS
- Contabilidad
- Reportes funcionales

No agregar:

- Datos quemados.
- Credenciales reales.
- Tablas nuevas de negocio.
- Endpoints de modulos funcionales.

## Criterios de aceptacion

La fase se considera completada cuando:

- Existe manejo centralizado de errores con `AppError`.
- Existe logger base.
- Existe validacion reutilizable con `zod`.
- Existen utilidades de paginacion.
- Existen utilidades de ordenamiento seguro.
- Existen tipos de filtros comunes.
- Existe contexto SaaS estandarizado.
- Existe base reusable para repositorios SQL Server.
- Existe helper preparado para auditoria funcional.
- Todos los endpoints existentes siguen funcionando.
- `npm run typecheck` pasa.
- `npm run build` pasa.
- No se implementaron modulos fuera de alcance.
