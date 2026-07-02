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

## Ejecucion local de migraciones

Desde la raiz del repositorio:

```powershell
npm run db:migrate
```

El runner ejecuta los archivos de `database/sqlserver/migrations` en orden alfabetico y registra cada archivo aplicado en `dbo.SchemaMigrations`. Usa una base de datos local ya creada y la configuracion de `.env`.

Para datos de desarrollo:

```powershell
npm run db:seed
```

El seed `seeds/002_local_dev_seed.sql` crea datos minimos idempotentes para pruebas locales:

- Tenant demo.
- Empresa demo.
- Usuario `demo@dobles.local` con password `Demo12345!`.
- Rol local y permisos de lectura/escritura basicos para catálogos runtime.
- Moneda, unidad, condicion de pago y categoria fiscal.
- Cliente, proveedor, categoria, marca y articulo demo si las tablas existen.

Para ejecutar ambos pasos:

```powershell
npm run db:setup
```

Estos scripts son para entorno local/dev. No reemplazan un proceso formal de despliegue productivo.
