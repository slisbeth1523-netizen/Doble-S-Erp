# Doble S ERP - Roadmap

Fecha de inicio documental: 2026-06-29

## Objetivo

Organizar la construccion de Doble S ERP por fases, evitando desarrollar modulos grandes antes de tener una base SaaS solida.

## Fase 0 - Fundacion del repositorio

Estado: iniciada.

- Crear documentacion base.
- Definir vision del producto.
- Documentar arquitectura recomendada.
- Documentar reglas fiscales dominicanas.
- Definir instrucciones para asistentes de codigo.
- Confirmar si existe codigo legacy que debe migrarse o integrarse.

## Fase 1 - Arquitectura base SaaS

- Definir stack oficial de frontend, backend y base de datos.
- Crear estructura modular del repositorio.
- Configurar SQL Server por variables de entorno.
- Crear sistema de migraciones.
- Implementar autenticacion.
- Implementar tenants, empresas, sucursales y usuarios.
- Implementar roles y permisos.
- Implementar auditoria base.
- Configurar manejo centralizado de errores y logs.

## Fase 2 - Modulo fiscal RD

- Modelar tipos de comprobantes fiscales.
- Modelar secuencias NCF y e-CF.
- Configurar impuestos, retenciones y vigencias.
- Preparar integracion con DGII.
- Crear validaciones fiscales reutilizables.
- Definir estados de documentos fiscales.
- Preparar reportes 606, 607, 608 y 609.

## Fase 3 - Maestros operativos

- Clientes.
- Proveedores.
- Productos y servicios.
- Unidades de medida.
- Almacenes.
- Listas de precios.
- Bancos.
- Catalogo contable.

## Fase 4 - Procesos comerciales

- Cotizaciones.
- Pedidos.
- Facturacion.
- Recibos.
- Cuentas por cobrar.
- Requisiciones.
- Ordenes de compra.
- Recepciones.
- Facturas de proveedor.
- Cuentas por pagar.

## Fase 5 - Inventario y contabilidad integrada

- Movimientos de inventario.
- Kardex.
- Costeo.
- Asientos automaticos.
- Periodos contables.
- Cierres.
- Conciliacion bancaria.
- Estados financieros.

## Fase 6 - Modulos ampliados

- Nomina.
- Recursos humanos.
- CRM.
- Produccion.
- Servicios.
- Activos fijos.
- Reportes gerenciales.

## Fase 7 - SaaS empresarial

- Planes y suscripciones.
- Limites por tenant.
- Backups.
- Observabilidad.
- Monitoreo.
- Escalabilidad.
- Seguridad avanzada.
- Integraciones externas.

## Reglas de avance

- No iniciar facturacion sin modulo fiscal base.
- No iniciar procesos comerciales sin clientes, productos y empresas.
- No iniciar contabilidad automatica sin catalogo contable y reglas configurables.
- No usar datos quemados para impuestos, comprobantes, empresas, usuarios o secuencias.
- No mezclar pantallas de modulos distintos.
- Toda entidad transaccional debe contemplar multiempresa y auditoria.

