# Arquitectura del Monorepo

Doble S ERP se organiza como un monorepo para mantener API, frontend, paquetes compartidos, documentacion y base de datos bajo una misma version.

## Estructura

```text
apps/
  api/
  web/
database/
  sqlserver/
docs/
  phases/
  architecture/
packages/
  shared/
  config/
```

## Reglas

- `apps/api` contiene la API base y futuros modulos backend.
- `apps/web` contiene el frontend React.
- `packages/shared` contiene tipos compartidos sin logica de negocio pesada.
- `packages/config` contiene constantes y configuracion comun segura.
- `database/sqlserver` contiene migraciones y seeds parametrizables.

No se deben agregar datos quemados, credenciales reales ni modulos grandes fuera del alcance de la fase activa.

