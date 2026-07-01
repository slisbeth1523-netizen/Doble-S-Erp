# Tarea para Codex - Fase 1.3 Core Framework

## Proyecto

Doble S ERP

## Objetivo

Implementar la Fase 1.3: Core Framework.

Esta fase NO debe crear modulos de negocio. Su objetivo es construir infraestructura transversal reusable para futuros modulos.

Antes de programar, leer:

- `README.md`
- `CODEX_NEXT_TASK.md`
- `docs/phases/PHASE_1_1_FOUNDATION_HARDENING.md`
- `docs/phases/PHASE_1_2_TECHNICAL_BOOTSTRAP.md`
- `docs/phases/PHASE_1_3_CORE_FRAMEWORK.md`

## Instruccion principal

Implementa utilidades comunes para la API y paquetes compartidos, manteniendo el monorepo estable y sin agregar clientes, proveedores, inventario, ventas, compras, facturacion ni DGII.

## Tareas obligatorias

### 1. AppError y errores comunes

Crear en `apps/api/src/errors` o ubicacion equivalente:

- `AppError`
- `BadRequestError`
- `UnauthorizedError`
- `ForbiddenError`
- `NotFoundError`
- `ConflictError`
- `ValidationError`

Cada error debe tener:

- `statusCode`
- `code`
- `message`
- `details` opcional
- `isOperational`

Actualizar el middleware de errores para usar estos errores y mantener respuestas JSON estandarizadas.

### 2. Logger base

Crear logger reutilizable en la API.

Debe soportar:

- `debug`
- `info`
- `warn`
- `error`

Evitar `console.log` disperso. Si el servidor usa console al iniciar, moverlo al logger.

### 3. Validacion con zod

Agregar `zod` si no esta declarado.

Crear middleware/helper para validar:

- `body`
- `params`
- `query`

Cuando falle, responder HTTP 400 usando el formato estandar.

### 4. Paginacion

Crear utilidades y tipos para:

- `page`
- `pageSize`
- `offset`
- `limit`
- `totalItems`
- `totalPages`

Reglas:

- `page` minimo 1.
- `pageSize` minimo 1.
- `pageSize` maximo 100.
- valores por defecto seguros.

### 5. Ordenamiento seguro

Crear utilidades para:

- `sortBy`
- `sortDirection`

Reglas:

- `sortDirection` solo `asc` o `desc`.
- `sortBy` debe validarse contra una lista permitida por cada modulo.
- No generar SQL dinamico inseguro.

### 6. Filtros base

Crear tipos base para filtros comunes:

- `search`
- `isActive`
- `createdFrom`
- `createdTo`

No implementar filtros de modulos reales todavia.

### 7. Contexto SaaS

Estandarizar tipos/helpers para contexto por solicitud:

- `tenantId`
- `companyId`
- `userId`
- `jwtId`

No crear autenticacion nueva. Solo preparar la estructura reusable.

### 8. Base SQL Repository

Crear una base reusable para repositorios SQL Server.

Debe ayudar a:

- obtener el pool actual
- ejecutar queries parametrizadas
- ejecutar transacciones
- evitar SQL inseguro

No crear CRUD de clientes, proveedores ni productos.

### 9. Base Service

Crear clase/base conceptual para servicios futuros.

Debe ayudar a mantener separacion entre:

- controller
- service
- repository

No debe contener reglas de negocio de modulos todavia.

### 10. Auditoria helper

Crear helper preparado para registrar eventos funcionales futuros.

Debe aceptar:

- `tenantId`
- `companyId`
- `userId`
- `action`
- `entityName`
- `entityId`
- `metadata`

Si falla el registro de auditoria, no debe romper el flujo principal. Debe registrar warning.

## Restricciones absolutas

No implementar:

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
- Login nuevo
- Roles nuevos
- Datos quemados
- Credenciales reales

## Verificacion obligatoria

Ejecutar:

```bash
npm install
npm run typecheck
npm run build
```

Confirmar que los endpoints existentes siguen funcionando:

```text
GET /api/health
GET /api/health/db
GET /api/version
```

## Entrega esperada

Al finalizar, entregar resumen con:

- Archivos creados.
- Archivos modificados.
- Correcciones realizadas.
- Confirmacion de `npm run typecheck`.
- Confirmacion de `npm run build`.
- Confirmacion de que no se implementaron modulos funcionales fuera de alcance.

No marques la tarea como completada si no compila.
