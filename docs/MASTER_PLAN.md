# Doble S ERP - Plan Maestro de Arquitectura

Fecha de analisis: 2026-06-29

## 1. Alcance de esta primera tarea

Este documento prepara el plan maestro para convertir el proyecto en **Doble S ERP**, un ERP SaaS moderno, modular, multiempresa, multiusuario, con reglas fiscales de Republica Dominicana y adaptable a distintos tipos de negocio.

Restricciones respetadas:

- No se programaron modulos grandes.
- No se elimino codigo existente.
- No se asumieron datos quemados como solucion.
- No se mezclaron pantallas ni responsabilidades de modulos.
- Se documento la arquitectura objetivo por modulo, separando frontend, backend y base de datos.

## 2. Arquitectura actual encontrada

### 2.1 Resultado del analisis del repositorio

La carpeta analizada fue:

`C:\Users\ssoriano\OneDrive - Softland LAN\Documentos\Doble S Erp`

Al momento del analisis, la carpeta no contiene archivos fuente visibles ni estructura de proyecto detectable. Se reviso la raiz y el contenido recursivo, incluyendo archivos ocultos, y no se encontraron:

- Backend.
- Frontend.
- Rutas.
- Controladores.
- Modelos.
- Servicios.
- Migraciones.
- Archivos de configuracion.
- Conexion a SQL Server.
- Archivos de solucion, proyecto o dependencias.

Tambien se intento consultar estado de Git, pero `git` no esta disponible en este entorno, por lo que no se pudo validar historial, ramas o cambios pendientes.

### 2.2 Elementos cercanos encontrados fuera del repositorio

En la carpeta superior `Documentos` existen elementos relacionados o potencialmente relevantes, pero no forman parte del repositorio actual:

- `ERPWeb.exe`
- `DocumentosElectronicos.zip`
- `WINDOWS COMERCIAL.zip`
- Carpeta `DocumentosElectronicos`
- Carpeta `ArchivosSoftlandERP`

Estos elementos no deben considerarse codigo del proyecto sin una confirmacion explicita. Si alguno contiene el sistema actual, debe moverse o extraerse a una carpeta de trabajo controlada antes de analizarlo.

## 3. Problemas encontrados

### 3.1 Problemas de repositorio

- El repositorio esta vacio o no sincronizado localmente.
- No existe una estructura minima de aplicacion.
- No hay evidencia de control de versiones disponible desde el entorno actual.
- No hay archivos de configuracion para entorno, base de datos o despliegue.
- No se pudo identificar stack tecnologico actual.

### 3.2 Problemas de arquitectura

Como no hay codigo fuente visible, todavia no existe una separacion verificable entre:

- Dominio.
- Aplicacion.
- Infraestructura.
- API.
- UI.
- Persistencia.
- Autenticacion.
- Multiempresa.
- Auditoria.
- Fiscalidad.

### 3.3 Problemas de producto que deben evitarse

- Crear pantallas generales mezclando ventas, compras, inventario, contabilidad y fiscalidad.
- Usar datos fijos para empresas, impuestos, monedas, NCF, almacenes, usuarios o clientes.
- Diseñar tablas compartidas sin columna o estrategia de tenant.
- Construir facturacion sin motor fiscal versionado.
- Implementar documentos fiscales sin trazabilidad, auditoria y estados claros.
- Integrar e-CF al final del proyecto en vez de considerarlo desde la arquitectura base.

## 4. Arquitectura recomendada

### 4.1 Enfoque general

Se recomienda construir Doble S ERP como un **modular monolith SaaS** en su primera etapa, preparado para evolucionar a servicios separados si el volumen lo exige.

Razon:

- Permite avanzar rapido sin sobrecargar el proyecto con microservicios prematuros.
- Mantiene limites claros por modulo.
- Reduce complejidad operativa.
- Facilita transacciones entre modulos criticos como ventas, inventario, cuentas por cobrar y contabilidad.
- Permite separar responsabilidades por carpetas, esquemas de base de datos y contratos internos.

### 4.2 Capas recomendadas

Cada modulo debe organizarse con capas consistentes:

- **Frontend**: vistas, componentes, formularios, validaciones visuales, rutas del modulo.
- **Backend/API**: endpoints, validacion de entrada, autorizacion, contratos DTO.
- **Aplicacion**: casos de uso, comandos, consultas, orquestacion de procesos.
- **Dominio**: entidades, reglas de negocio, invariantes, politicas.
- **Infraestructura**: repositorios, SQL Server, integraciones externas, archivos, correo, DGII.
- **Base de datos**: tablas, indices, constraints, migraciones, seeds parametrizables.

### 4.3 Multiempresa y multiusuario

La plataforma debe contemplar desde el inicio:

- Tenant o grupo empresarial.
- Empresa legal dentro del tenant.
- Sucursales.
- Almacenes.
- Puntos de emision.
- Usuarios con acceso a una o varias empresas.
- Roles por empresa.
- Permisos granulares por modulo, accion y recurso.
- Configuracion fiscal por empresa.
- Numeracion y secuencias por empresa, tipo de documento, sucursal y punto de emision.
- Auditoria por usuario, fecha, empresa, modulo, entidad y accion.

### 4.4 Estrategia de base de datos

Para SQL Server se recomienda iniciar con una sola base de datos SaaS y separacion logica por tenant:

- Todas las tablas transaccionales deben incluir `TenantId` y `CompanyId` cuando aplique.
- Tablas maestras globales deben distinguir entre datos del sistema y datos configurables por tenant.
- Usar esquemas SQL por dominio: `core`, `security`, `fiscal`, `sales`, `purchases`, `inventory`, `finance`, `accounting`, `hr`, `crm`, `audit`.
- Crear indices compuestos por `TenantId`, `CompanyId` y claves de busqueda frecuentes.
- Aplicar constraints y claves foraneas reales, no solo validaciones en codigo.
- Considerar Row-Level Security de SQL Server cuando la madurez del proyecto lo permita.

### 4.5 Integracion fiscal como plataforma interna

La fiscalidad dominicana debe ser un modulo transversal, no logica duplicada en ventas o compras.

El modulo fiscal debe manejar:

- Tipos de comprobantes fiscales.
- Secuencias NCF y e-CF.
- Reglas de ITBIS.
- Retenciones.
- Reportes y formatos DGII.
- Validacion de RNC/Cedula cuando aplique.
- Estados de documentos fiscales.
- Anulaciones, notas de credito y notas de debito.
- Trazabilidad de envio, aceptacion, rechazo y contingencia.

## 5. Modulos requeridos

### 5.1 Plataforma base

- Core SaaS: tenants, empresas, sucursales, monedas, tasas, parametros.
- Seguridad: usuarios, roles, permisos, sesiones, MFA opcional.
- Auditoria: bitacora de acciones, cambios de datos, login, errores criticos.
- Configuracion: preferencias por tenant, empresa y modulo.
- Archivos: adjuntos, logos, certificados, documentos fiscales, plantillas.
- Notificaciones: correo, alertas internas, tareas pendientes.

### 5.2 Fiscal Republica Dominicana

- Registro de RNC/Cedula y validaciones.
- Gestion de NCF y e-CF.
- Tipos de comprobantes.
- Secuencias por empresa, sucursal y punto de emision.
- ITBIS por producto, servicio, cliente, proveedor y documento.
- Retenciones de ITBIS e ISR.
- Formatos DGII: 606, 607, 608, 609 y los que apliquen segun actividad.
- Anulacion de comprobantes.
- Notas de credito y debito.
- Integracion con facturacion electronica DGII.
- Contingencia fiscal.

### 5.3 Ventas y cuentas por cobrar

- Clientes.
- Cotizaciones.
- Pedidos.
- Facturas.
- Facturacion fiscal.
- Notas de credito/debito.
- Recibos de ingreso.
- Cuentas por cobrar.
- Limites de credito.
- Vendedores y comisiones.
- Precios y listas de precios.

### 5.4 Compras y cuentas por pagar

- Proveedores.
- Requisiciones.
- Ordenes de compra.
- Recepcion de mercancia.
- Facturas de proveedor.
- Gastos.
- Retenciones.
- Cuentas por pagar.
- Pagos.
- Conciliacion contra comprobantes fiscales.

### 5.5 Inventario

- Productos y servicios.
- Categorias.
- Unidades de medida.
- Almacenes.
- Existencias.
- Lotes y vencimientos.
- Series.
- Transferencias.
- Ajustes.
- Costeo promedio, FIFO u otro metodo configurable.
- Kardex.

### 5.6 Contabilidad y finanzas

- Catalogo de cuentas.
- Asientos contables.
- Diario general.
- Mayor general.
- Periodos contables.
- Cierres.
- Conciliacion bancaria.
- Bancos.
- Flujo de caja.
- Estados financieros.
- Integracion automatica desde ventas, compras, inventario, nomina y activos.

### 5.7 Nomina y recursos humanos

- Empleados.
- Departamentos y puestos.
- Contratos.
- Nomina.
- Deducciones.
- Horas extra.
- Vacaciones.
- Prestaciones.
- TSS, ISR asalariados e INFOTEP si aplica.

### 5.8 CRM y operaciones comerciales

- Prospectos.
- Oportunidades.
- Actividades.
- Seguimientos.
- Campanas.
- Tickets o casos.

### 5.9 Produccion o servicios

Debe ser opcional por tipo de negocio:

- Ordenes de produccion.
- Recetas/BOM.
- Consumo de materiales.
- Mano de obra.
- Costos de produccion.
- Ordenes de servicio.
- Contratos recurrentes.
- Mesa de ayuda.

### 5.10 Reportes y analitica

- Reportes operativos por modulo.
- Indicadores gerenciales.
- Exportacion a Excel/PDF.
- Reportes fiscales.
- Trazabilidad de reportes generados.
- Tableros por rol.

## 6. Estructura de carpetas recomendada

La estructura exacta dependera del stack elegido, pero se recomienda esta organizacion base:

```text
DobleSErp/
  docs/
    MASTER_PLAN.md
    ARCHITECTURE.md
    DATABASE.md
    FISCAL_RD.md
    API_CONVENTIONS.md
  apps/
    web/
      src/
        modules/
          core/
          security/
          fiscal/
          sales/
          purchases/
          inventory/
          accounting/
          finance/
          hr/
          crm/
        shared/
        routes/
        layouts/
    api/
      src/
        modules/
          core/
            api/
            application/
            domain/
            infrastructure/
            database/
          security/
          fiscal/
          sales/
          purchases/
          inventory/
          accounting/
          finance/
          hr/
          crm/
        shared/
          auth/
          database/
          errors/
          events/
          logging/
          validation/
  database/
    sqlserver/
      schemas/
      migrations/
      seeds/
      functions/
      procedures/
      views/
  integrations/
    dgii/
    email/
    storage/
    banks/
  tests/
    unit/
    integration/
    e2e/
  deployment/
    docker/
    pipelines/
    environments/
```

### 6.1 Regla de separacion por modulo

Cada modulo debe tener su propio espacio:

```text
modules/sales/
  api/
  application/
  domain/
  infrastructure/
  database/
  frontend/
```

Ningun modulo debe escribir directamente tablas internas de otro modulo. La comunicacion debe hacerse por:

- Servicios de aplicacion.
- Eventos internos.
- Contratos publicos del modulo.
- Vistas de lectura autorizadas.

## 7. Orden correcto de implementacion

### Fase 0 - Recuperacion y diagnostico real del codigo

1. Confirmar si el codigo fuente esta en otra carpeta, zip, exe o repositorio remoto.
2. Colocar el codigo real dentro de la carpeta del proyecto.
3. Inicializar o recuperar control de versiones.
4. Documentar stack actual.
5. Identificar dependencias, conexion SQL Server, rutas, modelos y pantallas reales.

### Fase 1 - Fundacion SaaS

1. Definir stack oficial.
2. Crear estructura base del repositorio.
3. Configurar entornos: desarrollo, pruebas, produccion.
4. Implementar autenticacion.
5. Implementar tenants, empresas, sucursales y usuarios.
6. Implementar roles y permisos.
7. Crear auditoria base.
8. Crear conexion SQL Server y migraciones.

### Fase 2 - Fiscal RD

1. Crear modulo fiscal.
2. Modelar tipos de comprobante.
3. Modelar secuencias NCF/e-CF.
4. Configurar impuestos y retenciones por empresa.
5. Implementar validaciones fiscales reutilizables.
6. Preparar integracion de facturacion electronica DGII.
7. Crear reportes fiscales base.

### Fase 3 - Maestros operativos

1. Clientes.
2. Proveedores.
3. Productos y servicios.
4. Almacenes.
5. Listas de precios.
6. Catalogo de cuentas.
7. Bancos.

### Fase 4 - Procesos comerciales

1. Cotizaciones.
2. Pedidos.
3. Facturas.
4. Recibos.
5. Cuentas por cobrar.
6. Ordenes de compra.
7. Recepciones.
8. Facturas de proveedor.
9. Cuentas por pagar.

### Fase 5 - Inventario y contabilidad integrada

1. Movimientos de inventario.
2. Kardex.
3. Costeo.
4. Asientos automaticos.
5. Conciliacion contable por modulo.
6. Cierres.

### Fase 6 - Nomina, CRM, produccion y reportes avanzados

1. Nomina.
2. RRHH.
3. CRM.
4. Produccion o servicios.
5. Dashboards gerenciales.
6. Reportes avanzados.

### Fase 7 - SaaS empresarial

1. Planes y suscripciones.
2. Limites por tenant.
3. Facturacion del propio SaaS.
4. Observabilidad.
5. Backups.
6. Escalabilidad.
7. Seguridad avanzada.

## 8. Riesgos tecnicos

- Repositorio vacio: no se puede asegurar compatibilidad con funcionalidades actuales hasta encontrar el codigo real.
- Migracion desde sistemas legacy: puede requerir limpieza profunda de datos.
- SQL Server multiempresa: riesgo de fuga de datos si no se aplica `TenantId` de forma uniforme.
- Fiscalidad dominicana: cambios normativos pueden afectar facturacion, reportes y validaciones.
- Facturacion electronica: requiere certificados, ambiente de pruebas, manejo de estados, contingencia y trazabilidad.
- Numeracion fiscal: cualquier error puede generar documentos invalidos o duplicados.
- Contabilidad automatica: requiere reglas claras por tipo de transaccion y configuracion por empresa.
- Inventario y costo: errores de concurrencia pueden afectar existencias y margen.
- Permisos: roles simples no bastan para un ERP multiempresa.
- Datos quemados: deben reemplazarse por catalogos, parametros y configuraciones versionadas.
- Reportes fiscales: deben cuadrar con documentos, anulaciones, retenciones y periodos.
- Integraciones bancarias y DGII: pueden fallar por disponibilidad externa y cambios de formato.

## 9. Reglas fiscales dominicanas que deben contemplarse

> Nota: las reglas fiscales deben validarse contra fuentes oficiales de DGII antes de cada liberacion. Este documento no sustituye asesoria fiscal ni legal.

### 9.1 Comprobantes fiscales

El sistema debe soportar, como minimo:

- Facturas con valor fiscal.
- Facturas de consumo.
- Notas de debito.
- Notas de credito.
- Comprobantes para regimenes especiales cuando apliquen.
- Comprobantes gubernamentales cuando apliquen.
- Comprobantes de compras.
- Comprobantes de gastos menores.
- Comprobantes para pagos al exterior.
- e-CF segun los tipos aprobados por DGII.

Debe manejar:

- Solicitud, asignacion y control de secuencias.
- Vencimiento de secuencias cuando aplique.
- Consumo por punto de emision.
- Evitar duplicidad de NCF/e-CF.
- Anulacion y trazabilidad.
- Relacion entre nota de credito/debito y documento afectado.

### 9.2 Facturacion electronica

El ERP debe estar preparado para:

- Emisor electronico.
- Certificados digitales.
- Firma digital.
- XML fiscal.
- Envio a DGII.
- Recepcion de respuestas.
- Estados: generado, firmado, enviado, aceptado, rechazado, anulado, contingencia.
- Representacion impresa.
- Codigo de seguridad y QR cuando aplique.
- Almacenamiento del XML firmado y respuesta DGII.

### 9.3 ITBIS

Debe contemplarse:

- Tasa general de ITBIS vigente.
- Bienes y servicios exentos.
- Productos gravados, exentos o con tratamiento especial.
- ITBIS facturado.
- ITBIS adelantado.
- ITBIS retenido.
- ITBIS sujeto a proporcionalidad cuando aplique.
- Separacion de base imponible, impuesto, descuentos y totales.

### 9.4 Retenciones

Debe contemplarse configuracion por:

- Tipo de contribuyente.
- Cliente/proveedor.
- Tipo de bien o servicio.
- Tipo de documento.
- Retenciones de ITBIS.
- Retenciones de ISR.
- Retenciones a personas fisicas.
- Retenciones a proveedores informales cuando aplique.
- Retenciones por pagos al exterior cuando aplique.

Las tasas no deben quemarse en codigo. Deben vivir en tablas parametrizables con vigencia desde/hasta.

### 9.5 Reportes y formatos DGII

Debe prepararse soporte para:

- 606: compras de bienes y servicios.
- 607: ventas de bienes y servicios.
- 608: comprobantes anulados.
- 609: pagos al exterior.
- Otros formatos requeridos segun el tipo de contribuyente o actividad.

Cada reporte debe generarse desde transacciones reales, no desde digitacion separada.

### 9.6 RNC, cedula y terceros

El sistema debe soportar:

- Validacion de RNC/Cedula.
- Tipo de identificacion.
- Nombre/Razon social.
- Clasificacion fiscal.
- Estado del contribuyente cuando se integre consulta oficial.
- Historial de cambios fiscales del tercero.

### 9.7 Contabilidad fiscal

Debe existir trazabilidad entre:

- Documento fiscal.
- Movimiento comercial.
- Cuenta por cobrar/pagar.
- Movimiento de inventario.
- Asiento contable.
- Reporte fiscal.

Ningun documento fiscal emitido debe eliminarse fisicamente. Debe anularse o reversarse segun corresponda.

### 9.8 Fuentes oficiales a consultar

- DGII: https://dgii.gov.do/
- Facturacion electronica DGII: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicos/
- Comprobantes fiscales DGII: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscales/
- Formatos de envio DGII: https://dgii.gov.do/servicios/formularios/formatoEnvioDatos/

## 10. Criterios de aceptacion para futuras fases

Antes de implementar modulos grandes, el proyecto debe tener:

- Codigo fuente real disponible en el repositorio.
- Stack tecnologico definido.
- Estructura modular creada.
- Conexion SQL Server configurada por variables de entorno.
- Migraciones iniciales.
- Autenticacion y autorizacion base.
- Tenant, empresa y usuario funcionando.
- Auditoria minima.
- Modulo fiscal base antes de facturacion.
- Pruebas automatizadas para reglas criticas.

## 11. Proxima accion recomendada

La siguiente tarea deberia ser una de estas dos:

1. Incorporar el codigo fuente real al repositorio y repetir el diagnostico tecnico.
2. Si no existe codigo previo, iniciar la Fase 1 con estructura base, stack oficial, SQL Server, autenticacion, multiempresa y auditoria.

