# Copilot Instructions - Doble S ERP

## Contexto del producto

Doble S ERP es un ERP SaaS moderno, modular, multiempresa y multiusuario, preparado para reglas fiscales de Republica Dominicana.

## Reglas obligatorias

- No crear modulos grandes sin una tarea explicita.
- No eliminar codigo existente sin justificacion documentada.
- No romper funcionalidades actuales.
- No usar datos quemados para empresas, usuarios, impuestos, NCF, e-CF, monedas, almacenes o permisos.
- No mezclar pantallas ni responsabilidades de modulos distintos.
- Cada modulo debe tener estructura propia de frontend, backend y base de datos.
- Toda funcionalidad transaccional debe contemplar multiempresa, multiusuario y auditoria.
- Las reglas fiscales dominicanas deben ser parametrizables y versionables.

## Arquitectura esperada

Preferir una arquitectura modular por dominio:

- `core`
- `security`
- `fiscal`
- `sales`
- `purchases`
- `inventory`
- `accounting`
- `finance`
- `hr`
- `crm`
- `reports`

Cada modulo debe separar:

- API o rutas.
- Casos de uso.
- Dominio.
- Infraestructura.
- Persistencia.
- Frontend.
- Pruebas.

## Base de datos

- El motor objetivo es SQL Server salvo decision documentada distinta.
- Las tablas transaccionales deben contemplar `TenantId` y `CompanyId` cuando aplique.
- Usar migraciones en lugar de cambios manuales no trazados.
- Usar claves foraneas, indices y restricciones reales.
- No guardar secretos en codigo.

## Fiscal Republica Dominicana

El modulo fiscal debe considerar:

- NCF.
- e-CF.
- ITBIS.
- Retenciones.
- RNC/Cedula.
- Reportes 606, 607, 608 y 609.
- Anulaciones.
- Notas de credito y debito.
- Trazabilidad con ventas, compras y contabilidad.

## Estilo de implementacion futura

- Mantener cambios pequenos y enfocados.
- Documentar decisiones importantes.
- Agregar pruebas para reglas criticas.
- Preferir configuracion por base de datos o variables de entorno.
- Evitar duplicacion de reglas entre modulos.
- Mantener interfaces claras entre dominios.

