# SQL Server

Carpeta reservada para scripts, migraciones, esquemas, vistas, funciones y procedimientos relacionados con SQL Server.

La base de datos debe contemplar arquitectura SaaS multiempresa:

- `TenantId` para separacion por cliente SaaS.
- `CompanyId` para separacion por empresa legal.
- Auditoria en tablas transaccionales.
- Migraciones trazables.
- Reglas fiscales parametrizables.

## Migraciones iniciales

- `migrations/001_initial_saas_foundation.sql`: crea esquemas `core`, `security`, `fiscal` y `audit`, con tablas base para tenants, empresas, sucursales, usuarios, roles, permisos, sesiones, configuracion fiscal y audit logs.
- `migrations/002_foundation_hardening.sql`: agrega auditoria funcional, estado activo para permisos e indice unico de sesiones por `JwtId`.

No se incluyen usuarios, empresas ni datos de prueba quemados. Esos datos deben crearse mediante procesos de onboarding o scripts parametrizados por ambiente.

## Onboarding

- `seeds/001_onboarding_admin.template.sql`: plantilla parametrizable para crear el primer tenant, empresa y usuario administrador.

La plantilla no incluye contrasenas reales. El valor `@AdminPasswordHash` debe generarse fuera del script usando el algoritmo de hashing configurado en la API.
