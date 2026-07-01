# Doble S ERP - Fiscalidad Republica Dominicana

## Proposito

Este documento define las reglas fiscales dominicanas que Doble S ERP debe contemplar desde su arquitectura base. No sustituye asesoria fiscal ni legal; las reglas deben validarse contra fuentes oficiales de DGII antes de cada liberacion.

## Principios fiscales del sistema

- Las tasas, tipos de comprobantes, secuencias y reglas fiscales deben ser parametrizables.
- Ninguna regla fiscal sensible debe estar quemada en codigo.
- Todo documento fiscal debe tener trazabilidad completa.
- Los documentos emitidos no deben eliminarse fisicamente; deben anularse, reversarse o corregirse segun corresponda.
- La fiscalidad debe vivir en un modulo transversal, no duplicada en ventas, compras o contabilidad.

## Comprobantes fiscales

El sistema debe soportar, segun aplique:

- Factura de credito fiscal.
- Factura de consumo.
- Nota de debito.
- Nota de credito.
- Comprobante de compras.
- Registro unico de ingresos.
- Registro de gastos menores.
- Comprobante para regimenes especiales.
- Comprobante gubernamental.
- Comprobante para exportaciones.
- Comprobante para pagos al exterior.
- Comprobantes fiscales electronicos e-CF.

## Secuencias NCF y e-CF

El ERP debe manejar:

- Secuencias por empresa.
- Secuencias por sucursal y punto de emision cuando aplique.
- Tipo de comprobante.
- Vigencia.
- Rango autorizado.
- Proximo numero disponible.
- Control de duplicidad.
- Estado de la secuencia.
- Auditoria de consumo.

## Facturacion electronica

La plataforma debe prepararse para:

- Certificados digitales.
- Firma digital.
- Generacion de XML fiscal.
- Envio a DGII.
- Recepcion y almacenamiento de respuestas.
- Estados de aceptacion, rechazo, anulacion y contingencia.
- Representacion impresa.
- Codigo QR y codigo de seguridad cuando aplique.
- Conservacion del XML firmado.

## ITBIS

Debe contemplarse:

- Tasa general vigente.
- Bienes y servicios exentos.
- Bienes y servicios gravados.
- ITBIS facturado.
- ITBIS adelantado.
- ITBIS retenido.
- Descuentos antes o despues de impuesto segun configuracion fiscal.
- Base imponible separada del impuesto.

## Retenciones

Las retenciones deben configurarse por vigencia y contexto:

- Tipo de tercero.
- Tipo de documento.
- Tipo de bien o servicio.
- Retencion de ITBIS.
- Retencion de ISR.
- Pagos a personas fisicas.
- Pagos al exterior.
- Proveedores informales cuando aplique.

## Reportes DGII

El sistema debe estar preparado para generar:

- 606: compras de bienes y servicios.
- 607: ventas de bienes y servicios.
- 608: comprobantes anulados.
- 609: pagos al exterior.

Los reportes deben generarse desde transacciones reales del ERP, con trazabilidad hacia el documento fiscal, tercero, asiento contable y periodo.

## RNC, cedula y terceros

Debe contemplarse:

- Tipo de identificacion.
- RNC o cedula.
- Nombre o razon social.
- Clasificacion fiscal.
- Estado del contribuyente cuando exista integracion oficial.
- Historial de cambios.

## Contabilidad fiscal

Cada documento fiscal debe poder relacionarse con:

- Cliente o proveedor.
- Documento comercial.
- Cuenta por cobrar o pagar.
- Movimiento de inventario cuando aplique.
- Asiento contable.
- Reporte DGII.

## Fuentes oficiales

- DGII: https://dgii.gov.do/
- Comprobantes fiscales: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscales/
- Comprobantes fiscales electronicos: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicos/
- Formatos de envio de datos: https://dgii.gov.do/servicios/formularios/formatoEnvioDatos/

